const cert = require('./cert.json');
const _ = require('lodash');
const firebase_databaseURL = "https://planme-1383.firebaseio.com";

const firebase = require("firebase-admin");

firebase.initializeApp({
    credential: firebase.credential.cert(cert),
    databaseURL: firebase_databaseURL,
});

const firebaseDataBase = firebase.database();

exports.getUniqKey = (path) => {
    return firebaseDataBase.ref(path).push().key;
}

exports.createObjOnFireBase = async (dbUpdates) => {
    await firebaseDataBase.ref().update(dbUpdates);
}

exports.threadSleep = function (delay) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            console.log(`sleep for ${delay}`);
            resolve(true);
        }, delay);
    });
}
