import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

import SignalProtocolStore from './signalProtocolStore';

var ByteBuffer = require("bytebuffer");

const libsignal = window.libsignal;

//const libsignal = window.libsignal;

class App extends Component {

  state = {
    textArray: [],
    userKeys: {},
    registeredUsers: []
  }

  componentDidMount = async () => {

    var KeyHelper = libsignal.KeyHelper;

    //Create Alice and Bob
    let alice = {};
    let bob = {};

    //Create addresses
    alice.address = new libsignal.SignalProtocolAddress("alice", 1);
    bob.address  = new libsignal.SignalProtocolAddress("bob", 1);

    //Create Stores
    alice.store = new SignalProtocolStore();
    bob.store = new SignalProtocolStore();

    //Create identities
    await alice.store.put('identityKey', KeyHelper.generateIdentityKeyPair())
    await alice.store.put('registrationId', KeyHelper.generateRegistrationId())
    await bob.store.put('identityKey', KeyHelper.generateIdentityKeyPair())
    await bob.store.put('registrationId', KeyHelper.generateRegistrationId())

    //Create pre-keys for Bob
    bob.preKey = await KeyHelper.generatePreKey(1)
    bob.signedPreKey = await KeyHelper.generateSignedPreKey(await bob.store.getIdentityKeyPair(), 1)
    bob.store.storePreKey(1, bob.preKey.keyPair);
    bob.store.storeSignedPreKey(1, bob.signedPreKey.keyPair);

    //Create pre-key bundle
    bob.preKeyBundle = {
        identityKey: (await bob.store.getIdentityKeyPair()).pubKey,
        registrationId : await bob.store.getLocalRegistrationId(),
        preKey:  {
            keyId     : 1,
            publicKey : bob.preKey.keyPair.pubKey
        },
        signedPreKey: {
            keyId     : 1,
            publicKey : bob.signedPreKey.keyPair.pubKey,
            signature : bob.signedPreKey.signature
        }
    };

    //Pretend to send pre-key bundle to Alice
    //Create session
    alice.session = new libsignal.SessionBuilder(alice.store, bob.address);
    await alice.session.processPreKey(bob.preKeyBundle)

    //
    // FIRST MESSAGE
    //
    //Encrypt
    alice.message = {}
    alice.message.plainText = util.toArrayBuffer("my message ......");
    alice.message.sessionCipher = new libsignal.SessionCipher(alice.store, bob.address);
    alice.message.cipherText = await alice.message.sessionCipher.encrypt(alice.message.plainText)

    //Decrypt
    bob.message = {}
    bob.message.sessionCipher = new libsignal.SessionCipher(bob.store, alice.address);
    bob.message.plainText = util.toString(await bob.message.sessionCipher.decryptPreKeyWhisperMessage(alice.message.cipherText.body, 'binary'));

    console.log(bob.message.plainText);

    //
    //Second Message
    //
    //Encrypt
    bob.message.plainText = util.toArrayBuffer("another message ......");
    bob.message.cipherText = await bob.message.sessionCipher.encrypt(bob.message.plainText)

    //Decrypt
    alice.message.plainText = util.toString(await alice.message.sessionCipher.decryptWhisperMessage(bob.message.cipherText.body, 'binary'));

    console.log(alice.message.plainText)

  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">A demonstration of the signal protocol</h1>
        </header>
        <div className="Content-holder">
          <p style={{'margin-left': 'auto', 'margin-right': 'auto', 'margin-top': '10%'}}>Please check your browser's web console to see the decrypted outputs</p>
        </div>
      </div>
    );
  }
}

export default App;

var util = (function() {

  var StaticArrayBufferProto = new ArrayBuffer().__proto__;

  return {
      toString: function(thing) {
          if (typeof thing === 'string') {
              return thing;
          }
          return new ByteBuffer.wrap(thing).toString('binary');
      },
      toArrayBuffer: function(thing) {
          if (thing === undefined) {
              return undefined;
          }
          if (thing === Object(thing)) {
              if (thing.__proto__ === StaticArrayBufferProto) {
                  return thing;
              }
          }

          // eslint-disable-next-line
          var str;
          if (typeof thing === "string") {
              str = thing;
          } else {
              throw new Error("Tried to convert a non-string of type " + typeof thing + " to an array buffer");
          }
          return new ByteBuffer.wrap(thing, 'binary').toArrayBuffer();
      },
      isEqual: function(a, b) {
          // TODO: Special-case arraybuffers, etc
          if (a === undefined || b === undefined) {
              return false;
          }
          a = util.toString(a);
          b = util.toString(b);
          var maxLength = Math.max(a.length, b.length);
          if (maxLength < 5) {
              throw new Error("a/b compare too short");
          }
          return a.substring(0, Math.min(maxLength, a.length)) === b.substring(0, Math.min(maxLength, b.length));
      }
  };
})();
