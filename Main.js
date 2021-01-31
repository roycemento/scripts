const _ = require('lodash');
const Forms = require('./Forms');

const PROJECTS = {
    'Rova': '-LjjY-E27b5c1oDCC_As',
    'WineCity': '-LxQvZ4EoTtj_Iooo1dM',
    'Ako4849': '-Lphubp28k4lvvUevhkk',
    'Ako4041': '-LphpKAEIvyW9f-uhYZI',
    'Narkisim': '-MD9MZmPwfd2YjzDNQpm',
    'ParkSelected': '-MAuS5IW7OgXn-Os9Ewm',
    'GilProject': "-M-y3y7wQiu8NFLNCtzX"
};


// const runScript = async () => {
//     for (let projectName in PROJECTS) {
//         let projectId = _.get(PROJECTS, [projectName]);
//         await Scripts.patchSiteControlEmployees(projectId, {log: null});

//         console.log(`Running script on: ${projectName}`);
//         console.log('');
//     }
// };

// runScript(); 

Forms.fix("-MDnQwr-7yxE0hB23CDl", "general", "-MDoJj-wLtrpQMJqoDny", "locationsInfo", 'he');
