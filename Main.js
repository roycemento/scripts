const Forms = require('./Forms');
const Templates = require('./Templates');
const Posts = require('./Posts');
const SiteControl = require('./SiteControl');
const utils = require('./Utils');

const _ = require('lodash');
const axios = require('axios');

const apiServerDev = 'http://localhost:8080';
const apiServerProd = 'https://api-dot-planme-1383.appspot.com';

Forms.syncFormsToNewPropertyInstance('-LHP_8cU0nhx6-PNNXhp', 'unitApproval', 'locationsInfo', null, 'unitApproval_date');
