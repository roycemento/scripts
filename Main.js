const Forms = require('./Forms');
const Posts = require('./Posts');
const SiteControl = require('./SiteControl');

const _ = require('lodash');
const axios = require('axios');

const apiServerDev = 'http://localhost:8080';
const apiServerProd = 'https://api-dot-planme-1383.appspot.com';


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

// runScript(); 


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