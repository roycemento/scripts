const Forms = require('./Forms');
const Templates = require('./Templates');
const Posts = require('./Posts');
const SiteControl = require('./SiteControl');
const utils = require('./Utils');

const _ = require('lodash');
const axios = require('axios');

const apiServerDev = 'http://localhost:8080';
const apiServerProd = 'https://api-dot-planme-1383.appspot.com';



// addAppendix('-M9Dgnq2t3ZOEMnbL1_r', '-M_FWlLuQJv4Gef-D6Aa', [`https://firebasestorage.googleapis.com/v0/b/planme-1383.appspot.com/o/appendix%2Fprojects%2F-M9Dgnq2t3ZOEMnbL1_r%2Fforms%2F-M_FWlLuQJv4Gef-D6Aa%2Fimages%2Fimage.png?alt=media&token=64721259-174d-4489-b301-dbaf08d1977c`]);

// "-MARB_RGtQTknQfLY53Z", 
// const script = async () => {
//     let arr = ["-LnH-xulCVl2lUFC15tm", "-MLhRmxiiffEUZ6UD3UR", "-MR_YMPB5yrbTZ6cZr-t", "-MR__XjG5jJb-CiLfov4", "-MR_c-bWpyMtNgmecQT5"];
//     arr = ["-MARB_RGtQTknQfLY53Z"];

//     for (let i = 0; i < arr.length; i++) {
//         await Forms.regenerateForms(arr[i]);
//     }
// }

// script();