const cert = require('./cert.json');
const _ = require('lodash');
const firebase_databaseURL = "https://planme-1383.firebaseio.com";
const axios = require('axios');

const firebase = require("firebase-admin");

firebase.initializeApp({
    credential: firebase.credential.cert(cert),
    databaseURL: firebase_databaseURL,
});

const firebaseDataBase = firebase.database();

exports.axios = async function (req, requestParams = {}, config) {
    if (!_.get(requestParams, ['url']))
        return {};

    requestParams.url = requestParams.url.replace(/undefined|\[\]/g, '');

    _.set(requestParams, ['headers', 'Accept-Encoding'], '*');

    let ret = (await axios(requestParams, requestParams.headers));

    return ret.data;
}

exports.getCollection = async (path) => {
    if (!path)
        return;

    let ret = (await firebaseDataBase.ref(path).once('value')).val() || {};

    return ret;
}

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
