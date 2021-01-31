const axios = require('axios');
const _ = require('lodash');
const httpClient = require('urllib');
const parseXmlStringToJsObject = require('xml2js').parseString;


const apiServer = 'http://localhost:8080';

// // Options:
const statusUrl = 'http://30.0.0.100:80/ISAPI/Security/userCheck?format=json';
const testUrl = 'http://30.0.0.100:80/ISAPI/AccessControl/capabilities';
const url = 'http://30.0.0.100:80/ISAPI/AccessControl/AcsEvent?format=json&security=1&iv=54177f9a02ecf38840a4b37cc8506912';

const options = {
    method: 'GET',
    timeout: 30000,
    rejectUnauthorized: true,
    digestAuth: "admin:hvi12345",
    headers: { 'Content-Type': 'application/json' },
    // data: { "AcsEventTotalNumCond": { "major": 0, "minor": 0, "employeeNoString": "000MGdB8tp4z3GSYWnoYmv"} }
    // data: JSON.stringify({
    //     "AcsEventCond": {
    //         "searchID": "ecb89a35-cf1a-4b1e-8f43-3e05ba68c14d",
    //         "searchResultPosition": 0,
    //         "maxResults": 24,
    //         "major": 5,
    //         "minor": 75,
    //         "cardNo": "",
    //         "name": "",
    //         "employeeNoString": ""
    //     }
    // })
};

const responseHandler = async (err, data, res) => {
    if (err) {
        console.log(err);
    }

    // let resultXml = data.toString('utf8');
    // let temp1 = JSON.parse(res.data.toString('utf8'));
    // console.log("TCL ~ file: CameraReqApi.js ~ line 41 ~ responseHandler ~ temp1", temp1)

    await parseXmlStringToJsObject(data, (err, result) => {
        if (result) {
            console.log("TCL ~ file: Main.js ~ line 34 ~ awaitparseXmlStringToJsObject ~ result", result)
        }
        else
            console.log("TCL ~ file: Main.js ~ line 33 ~ awaitparseXmlStringToJsObject ~ err", err)
    });

    console.log(res.statusCode);
    console.log(res.headers);
}

httpClient.request(statusUrl, options, responseHandler);


