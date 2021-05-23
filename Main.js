const Forms = require('./Forms');
<<<<<<< HEAD
const Templates = require('./Templates');
const Posts = require('./Posts');
const SiteControl = require('./SiteControl');
const utils = require('./Utils');

const _ = require('lodash');
const axios = require('axios');
=======
const Posts = require('./Posts');
const SiteControl = require('./SiteControl');

const _ = require('lodash');
const axios = require('axios');

const apiServerDev = 'http://localhost:8080';
const apiServerProd = 'https://api-dot-planme-1383.appspot.com';
>>>>>>> 370654b9cdb80b822c5d266279cecfe958acbd81

const apiServerDev = 'http://localhost:8080';
const apiServerProd = 'https://api-dot-planme-1383.appspot.com';

<<<<<<< HEAD

=======
const runScript = async () => {
    let projectsWithCameras = (await axios(`${apiServerDev}/v1/projects?siteControl=true`)).data;

    for (let projectId in projectsWithCameras) {
        let projectName = _.get(projectsWithCameras, [projectId, 'title']);
        console.log(`Running script on: ${projectName}`);
        console.log('');

        await SiteControl.patchSiteControlEmployees(projectId, { log: null });

        console.log('');
        console.log('Finished.');
    }
};
>>>>>>> 370654b9cdb80b822c5d266279cecfe958acbd81

// addAppendix('-M9Dgnq2t3ZOEMnbL1_r', '-M_FWlLuQJv4Gef-D6Aa', [`https://firebasestorage.googleapis.com/v0/b/planme-1383.appspot.com/o/appendix%2Fprojects%2F-M9Dgnq2t3ZOEMnbL1_r%2Fforms%2F-M_FWlLuQJv4Gef-D6Aa%2Fimages%2Fimage.png?alt=media&token=64721259-174d-4489-b301-dbaf08d1977c`]);

// "-MARB_RGtQTknQfLY53Z", 
// const script = async () => {
//     let arr = ["-LnH-xulCVl2lUFC15tm", "-MLhRmxiiffEUZ6UD3UR", "-MR_YMPB5yrbTZ6cZr-t", "-MR__XjG5jJb-CiLfov4", "-MR_c-bWpyMtNgmecQT5"];
//     arr = ["-MARB_RGtQTknQfLY53Z"];

//     for (let i = 0; i < arr.length; i++) {
//         await Forms.regenerateForms(arr[i]);
//     }
// }

<<<<<<< HEAD
// script();
=======

const stressTestForRabbitMechanism = async () => {
    for (let i = 0; i < 5000; i++) {
        try {
            await axios.post(`${apiServerDev}/v1/Messages/publish`, {
                "exchangeName": "sc.services.dx",
                "routingKey": "sc.sync",
                "payload": {
                    "index": i,
                    "url": "http://localhost:8080/v1/siteControl/employees?projectId=-LjjY-E27b5c1oDCC_As",
                    "method": "GET"
                }
            });

            if (i % 100 === 0)
                await new Promise((resolve, reject) => {
                    setTimeout(() => resolve(true), 10000);
                })
        } catch (error) {
            console.log('error');
        }
    }
}

stressTestForRabbitMechanism()

// Forms.restoreForms('-Lu2kMsSscSgFILrYAMl', 'general', '-Lu6w2ok5h4GaqiEK0TQ',
//     [
//         '-MyOZikBONeUXzfSi013',
//     ]);

// _.values(PROJECTS).forEach(id => SiteControl.patchSiteControlEmployees(id, { log: null }));


// Posts.changeTaskAssign('-MJ1zm4YAS1XywHizdHb', '1076', 'sms|601f7cae2c673038a8d93093');
>>>>>>> 370654b9cdb80b822c5d266279cecfe958acbd81
