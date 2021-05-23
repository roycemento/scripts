const Forms = require('./Forms');
const Templates = require('./Templates');
const Posts = require('./Posts');
const SiteControl = require('./SiteControl');
const utils = require('./Utils');

const _ = require('lodash');
const axios = require('axios');

const apiServerDev = 'http://localhost:8080';
const apiServerProd = 'https://api-dot-planme-1383.appspot.com';


// Forms.syncFormsToNewPropertyInstance('-MDoc1KWXQHlQf_f_cPc', 'unitApproval_preDelivery', 'locationsInfo');