# Firebase connector

**GoogleAuth**

`google.com` firebaseAuth method

**GithubAuth**

`github.com` firebaseAuth method

**FacebookAuth**

`facebook.com` firebaseAuth method

**PasswordAuth**

email & password firebaseAuth method

**TwitterAuth**

`twitter.com` firebaseAuth method

**AnonymouslyAuth**

anonymous firebaseAuth method

**VkAuth**

`vk.com` is not among standard auth providers in firebase, so we provide our own solution for 
this. To get acquainted with the flow, please, read [this](https://vk.com/dev/implicit_flow_user) article.

In order to avoid creation of http server, vkAuthService works only with firebase and not with REST API.
So, we strongly recommend to set redirect url to be a current location, thus one can get a token on a client side.

Internal work of a service one can found in [source](./src/authMethods/vk.ts)

**Usage:**

`VkConfigService` declaration
```typescript
//vkAuthConfig.service.ts
import {Injectable} from "@angular/core";
import {VkAuthConfig, VkConfig, PopupConfig} from "@nodeart/firebase-connector";

@Injectable()
export class VkConfiguration implements VkAuthConfig {
    public vkConfig : VkConfig = {
        client_id: 'app_id',
        display: 'popup',
        scope: ['friends'],
        response_type: 'token',
        v: 5.63
    };
    public popupConfig: PopupConfig = {
        location: 'no',
        height: 600,
        width: 600
    };
    public cleanUp: boolean = true;
    public dbPath: string = 'auth/vk'; // #1 note that this field should be the same on server and client side #2;
    constructor() { }
}
```
`VkConfigService` register
```typescript
//someModule.module.ts
import {NgModule} from "@angular/core";
import {VkConfiguration} from "./vkAuthConfig.service";
@NgModule({
  providers: [
    {provide: 'VkAuthConfig', useClass: VkConfiguration}
  ]
})
export class SomeModule { }
```

Server side or [firebase cloud functions](https://firebase.google.com/docs/functions/) code:
```javascript
'use strict';

const admin = require('firebase-admin');
// #2 note that this field should be the same on server and client side #1;
const authWithVk = admin.database().ref('auth/vk'); 

const listener = (ref, snapshot) => {
  const key = snapshot.key,
        val = snapshot.val();
        
  if (!val.processed) {
    admin.auth()
        .createCustomToken(val['access_token'])
        .then(token => {
          const data = Object.assign(val, {
            access_token: token,
            expires_in: null,
            processed: true
          });
          ref.child(key).set(data);
          return data
        })
        .then(data => console.log(`custom token generated = ${JSON.stringify(data)}`))
  }
};

authWithVk.on('child_added', snapshot => listener(authWithVk, snapshot));
```