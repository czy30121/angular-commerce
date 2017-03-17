import { Http, Response } from '@angular/http';
import { esIndex } from './consts';
import {Injectable, Inject} from "@angular/core";
import * as firebase from 'firebase';
import { Observable } from "rxjs/Observable";
import { FormGroup } from '@angular/forms';
import { Subject } from 'rxjs/Subject';
/**
 * Service that realize logic with connecting to firebase realtime database and authentication.
 * Components user doesn't directly calls connector method. He calls them from [DAL]{@link https://www.npmjs.com/package/@nodeart/dal}
 */
@Injectable()
export class FirebaseConnector {

  /**
   * User visited router
   */
  private sfVisitedRoutes;
  
  /**
   * User performed clicks
   */
  private sfUserClicks;

  constructor(private http: Http){
  }

  /**
   * Connect [Session-flow]{@link https://www.npmjs.com/package/@nodeart/session-flow} to databese. 
   * 
   * @param {SessionFlow} sessionFlow  SessionFlow service
   * @param {string} deviceId  User device id generated by SessionFlow 
   * @param {string} sessionId  User session id generated by SessionFlow
   * 
   */
  connectSessionFlowToDB(sessionFlow, deviceId, sessionId) {
    this.sfVisitedRoutes = firebase.database()
      .ref('/session-flows/' + deviceId + '/' + sessionId + '/visitedRoutes');
    this.sfUserClicks = firebase.database()
      .ref('/session-flows/' + deviceId + '/' + sessionId + '/userClicks');  
    this.listenSfObject(sessionFlow);
  }

  /**
   * Subscribes to user visited routes and clicks
   * 
   * @param {SessionFlow} sf  SessionFlow service
   */
  private listenSfObject(sf) {
    sf.visitedRoute.subscribe((value) => {
      this.sfVisitedRoutes.push(value.getStringObject()); 
    });

    sf.click.asObservable().subscribe((value) => {
      this.sfUserClicks.push(value.getStringObject());
    });
  }


  /**
   * Returns firebase object. Avoid manipulating with connector directly. Use dal methods to communicate with connector 
   * 
   * @returns Firebase object
   */
  getFirebase(){
    return firebase;
  };

  /**
   * Returns firebase realtime database object. Avoid manipulating with connector directly. Use dal methods to communicate with connector
   * 
   * @returns Firebase realtime database object
   */
  getFirebaseDB(){
    return firebase.database();
  }

  /**
   * Returns firebase auth object. Avoid manipulating with connector directly. Use dal methods to communicate with connector
   * 
   * @returns Firebase auth object
   */
  getAuth(){
    return firebase.auth();
  }

  /**
   * Register user with email and password
   * 
   * @param {string} email  User email
   * @param {string} password  User password
   * 
   * @returns [firebase.Promise]{@link https://firebase.google.com/docs/reference/js/firebase.Promise} containing non-null [firebase.User]{@link https://firebase.google.com/docs/reference/js/firebase.User}
   */
  register(email, password){
    return firebase.auth().createUserWithEmailAndPassword(email, password);
  }

  /**
   * Register user with email and password. Save additional information in database
   * 
   * @param registerForm  Object that have email, password and any additional information about user. 
   * Additional information stores in firebase as user backet
   */
  registerUser(registerForm){
    let email = registerForm.email;
    let password = registerForm.password;
    delete registerForm.password;
    let userId = this.guid();
    return this.register(email, password).then(authData => {
      let firebaseUId = authData.uid;
      registerForm.firebaseUId = firebaseUId;
      firebase.database().ref('user/' + userId).set(registerForm).then(data => {
        console.log(data);
      });
    });
  }

  /**
   * Generate guid for user Id
   * 
   * @returns guid
   */
  private guid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
      s4() + '-' + s4() + s4() + s4();
  }

  /**
   * Login with email and password
   * 
   * @param {string} email  User email
   * @param {string} password  User password
   * 
   * @returns {Observable} Observable containing non-null [firebase.User]{@link https://firebase.google.com/docs/reference/js/firebase.User}
   */ 
  loginEmail(email, password){
    return Observable.create( observer => {
      firebase.auth().signInWithEmailAndPassword(email, password).then( data => {
        observer.next(data);
        observer.complete();
      });
    });
  }

  /**
   * Get user data
   * 
   * @param {string} uid  user Id
   * 
   * @returns [firebase.database.Reference]{@link https://firebase.google.com/docs/reference/js/firebase.database.Reference}
   */ 
  getUserData(uid){
    let queryObj = {
      query: {
        match: {
          "firebaseUId" : uid
        }
      }
    };
    return this.requestData(esIndex, 'user', queryObj);
  }

  /**
   * Logout user from firebase
   */
  logout(){
    firebase.auth().signOut();
  }

  /**
   * Check old session flow using device id
   * 
   * @param {string} deviceId  User device Id
   */
  checkOldSessionFlow(deviceId){
    if(localStorage.getItem("oldSessionFlow")){
      let oldSessionFlow = JSON.parse(localStorage.getItem("oldSessionFlow"));
      let sessionId = oldSessionFlow.sessionId;
      delete oldSessionFlow.sessionId;
      firebase.database().ref('/session-flows/' + deviceId + '/' + sessionId).set(oldSessionFlow);
    }
  }

  /**
   * Returns product by queryObj provided by DbAbstractionLayer
   * 
   * @param {Object} queryObj ElasticSearch query object
   * 
   * @returns {Observable} Observable of product object
   */
  getOneProduct(queryObj){
    let key = firebase.database().ref().child('search/request').push(queryObj).key;
    return Observable.create( observer => {
      firebase.database().ref().child('search/response/' + key + '/hits').on('value', data => {
        observer.next(data);
      });
    });
  }

  /**
   * Returns basket content of specific user
   * 
   * @param {string} userId user Id
   * 
   * @returns {Observable} Observable of basket
   */
  getBasketContent(userId){
    return Observable.create( observer => {
      firebase.database().ref().child('/basket/' + userId).on('value', data => {
        observer.next(data);
      });
    });
  }

  /**
   * Will be realized in next versions
   */
  getComparison(id){
    return firebase.database().ref().child('comparison/' + id).once('value');
  }

  /**
   * Returns Rx Subject of basket history of user by userId or deviceId
   * 
   * @param {string} userId  userId or deviceId
   * 
   * @returns {Subject} Rx Subject of basket history
   */
  getBasketHistorySubjectById(userId){
    let basketHistory$ = new Subject();
    basketHistory$.subscribe(data => {
      firebase.database().ref('/basket-history/' + userId).push(data);
    });
    return basketHistory$;
  }

  /**
   * Returns Rx Observable of basket history of user by userId or deviceId
   * 
   * @param {string} userId  userId or deviceId
   * 
   * @returns {Observable} Rx Observable of basket history
   */
   getBasketHistoryById(userId){
     return Observable.create( observer => {
        firebase.database().ref().child('/basket-history/' + userId).on('value', data => {
          observer.next(data);
        });
      });
   }


  /**
   * Set new basket by user id or device id
   * @param id  userId or deviceId
   * @param newBasket 
   * 
   * @returns {Observable} Observable of basket
   */
  setNewBasket(id, newBasket){
    return Observable.create( observer => {
        firebase.database().ref().child('basket/' + id).set(newBasket).then( data => {
          observer.next(data);
        });
    });
  }

  /**
   * Will be realized in next versions
   */
  addProductToComparison(id, product){
    return firebase.database().ref().child('comparison/' + id).push(product);
  }

  /**
   * Will be realized in next versions
   */
  removeProductFromComparison(id, idInComparison){
    return firebase.database().ref().child('comparison/' + id + '/' + idInComparison).remove();
  }

  /**
   * Gets data hits from firebase using [flashlight]{@link https://github.com/firebase/flashlight} lib for ElasticSearch
   * 
   * @param {string} index ElasticSearch index
   * @param {string} type ElasticSearch type
   * @param {Object} queryObj query object for ElasticSearch
   * 
   * @returns  {Observable} Observable of requested data hits
   */
  requestData(index, type, queryObj){
    let key = firebase.database().ref().child('search/request').push({
      index: index,
      type: type,
      query: JSON.stringify(queryObj)
    }).key;
    console.log(key);
    return Observable.create( observer => {
      firebase.database().ref().child('search/response/' + key + '/hits').on('value', data => {
        observer.next(data);
      });
    });
  }

  /**
   * Gets full data from firebase using [flashlight]{@link https://github.com/firebase/flashlight} lib for ElasticSearch
   * 
   * @param {string} index ElasticSearch index
   * @param {string} type ElasticSearch type
   * @param {Object} queryObj query object for ElasticSearch
   * 
   * @returns  {Observable} Observable of requested data
   */
  requestFullData(index, type, queryObj){
    let key = firebase.database().ref().child('search/request').push({
      index: index,
      type: type,
      query: JSON.stringify(queryObj)
    }).key;
    return Observable.create( observer => {
      firebase.database().ref().child('search/response/' + key).on('value', data => {
        observer.next(data);
      });
    });
  }

  /**
   * Gets total item of data from firebase using [flashlight]{@link https://github.com/firebase/flashlight} lib for ElasticSearch
   * 
   * @param {string} index ElasticSearch index
   * @param {string} type ElasticSearch type
   * @param {Object} queryObj query object for ElasticSearch
   * 
   * @returns  {Observable} Observable of total item
   */
  requestItemsTotal(index, type,queryObj){
    let key = firebase.database().ref().child('search/request').push({
      index: index,
      type: type,
      query: JSON.stringify(queryObj)
    }).key;
    return Observable.create( observer => {
      firebase.database().ref().child('search/response/' + key + '/total').on('value', data => {
        observer.next(data);
      });
    });
  }

  /**
   * Add product to database
   * 
   * @param {Object} product product Object
   */
  addProduct(product){
    firebase.database().ref('product/').push(product);
  }

  /**
   * Returns visited routes
   * 
   * @returns array of visited routes objects
   */
  getVisitedRoutes(){
    return this.sfVisitedRoutes;
  }

  /**
   * Returns user clicks 
   * 
   * @returns array of user clicks objects
   */
  getUserClicks(){
    return this.sfUserClicks;
  }

  /**
   * Add general category to database
   * 
   * @param {FormGroup} generalCategoryForm form of general category
   */
  addGeneralCategory(generalCategoryForm: FormGroup){
    firebase.database().ref('general-category').push(generalCategoryForm.value);
  }

  /**
   * Add category to database
   * 
   * @param {FormGroup} categoryForm  form of category
   */
  addCategory(categoryForm : FormGroup){
    firebase.database().ref('category/').push(categoryForm.value);
  }


  /**
   * Add new attribute to database
   * 
   * @param {FormGroup} attributeForm  form of attribute
   * @param {string} categoryId id of category
   */
  addAttribute(attributeForm : FormGroup, categoryId){
    firebase.database().ref('attributes/').push(attributeForm.value).then(ref => {
      firebase.database().ref().child('category/' + categoryId +'/attrs').once('value').then(data => {
          if(data.val()){
            console.log(data);
            if(data.val()[0] == '1234' && data.val()[1] == '1234'){
              let attrs = ['1234'];
              attrs.push(ref['key']);
              console.log(attrs);
              firebase.database().ref().child('category/' + categoryId + '/attrs').set(attrs);
            } else {
              let attrs = [].concat(...data.val());
              console.log(attrs);
              attrs.push(ref['key']);
              console.log(attrs);
              firebase.database().ref().child('category/' + categoryId + '/attrs').set(attrs);
            }
          }
      });
    });
  }

  /**
   * Add new tag to database
   * 
   * @param {FormGroup} tagForm  form of tag
   * @param {string} categoryId id of category
   */
  addTag(tagForm: FormGroup, categoryId){
    firebase.database().ref('tags/').push(tagForm.value).then(ref => {
      firebase.database().ref().child('category/' + categoryId +'/tags').once('value').then(data => {
          if(data.val()){
            console.log(data);
            if(data.val()[0] == '1234' && data.val()[1] == '1234'){
              let tags = ['1234'];
              tags.push(ref['key']);
              console.log(tags);
              firebase.database().ref().child('category/' + categoryId + '/tags').set(tags);
            } else {
              let tags = [].concat(data.val());
              tags.push(ref['key']);
              console.log(tags);
              firebase.database().ref().child('category/' + categoryId + '/tags').set(tags);
            }
          }
      });
    });
  }

  /**
   * Save new order to database
   * 
   * @param {Object} paymentData
   * 
   * @returns {Observable} Observable of orders
   */
  saveOrder(paymentData){
    return Observable.create( observer => {
      firebase.database().ref('orders').push(paymentData).then( data => {
        observer.next(data);
        observer.complete();
      });
    });
  }

  /**
   * Add payment requets. Server listens firebase backet with payments request and process coming requests
   * 
   * @param {Object} data PaymentData
   * @param {string} paymentMethod  name of payment method
   * 
   * @returns [firebase.database.ThenableReference]{@link https://firebase.google.com/docs/reference/js/firebase.database.ThenableReference}
   */
  addPaymentRequest(data, paymentMethod) {
    return firebase.database().ref('token-requests').push({
            data: data,
            payMethod: paymentMethod
        });
  }

  /**
   * Returns payment response by id
   * 
   * @param {string} paymentKey id of payment response. Payment request and payment response have same ids in their backets
   * 
   * @returns {Observable} Observable of payment response
   */
  listenPaymentResponse(paymentKey) {
    return Observable.create( observer => {
      firebase.database().ref('token-response/' + paymentKey).on('value', data => {
        if(data.val()){
          observer.next(data);
        }
      });
    });
  } 


  /**
   * Send letter with password resetting to specific email 
   * 
   * @param {string} email User email
   * 
   * @returns      [firebase.Promise]{@link https://firebase.google.com/docs/reference/js/firebase.Promise} containing void
   */
  resetPassword(email) {
    return firebase.auth().sendPasswordResetEmail(email);
  }

  /**
   * Get order by Id
   * @param id id of order
   * @returns {Observable} Observable of order
   */
  getOrderById(id) {
    return Observable.create( observer => {
      firebase.database().ref('orders/' + id).on('value', data => {
        if(data.val()){
          observer.next(data.val());
        }
      });
    });
  }
}
