const Forms = require('./Forms');
const Checklists = require('./Checklists');
const Templates = require('./Templates');
const Posts = require('./Posts');
const SiteControl = require('./SiteControl');
const utils = require('./Utils');
const UsersProjects = require('./UserProjects');
const Emails = require('./Emails');
const RecurringEvents = require('./RecurringEvents');

const _ = require('lodash');
const axios = require('axios');

const apiServerDev = 'http://localhost:8080';
const apiServerProd = 'https://api-dot-planme-1383.appspot.com';

// SiteControl.syncProjects();
Emails.analyze();




// Forms.syncFormsToNewPropertyInstance("-MX2Mj84Ilq-Cwp6Nbo3", "unitApproval", 'locationsInfo', 'he', "unitApproval_date", "פרוטוקול מסירת חזקה");