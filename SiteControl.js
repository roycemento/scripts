const axios = require('axios');
const _ = require('lodash');
const utils = require('./Utils');
const apiServer = 'http://localhost:8080';

const RESOURCES = {
    DELETE_USER: `${apiServer}/v1/siteControl/cameras`,
    PATCH_SC_EMPLOYEE: `${apiServer}/v1/siteControl/employees`,
    GET_EMPLOYEES_FROM_CAMERA: `${apiServer}/v1/siteControl/cameras/employees`,
    GET_SC_EMPLOYEES: `${apiServer}/v1/siteControl/employees`,
    GET_CEMENTO_EMPLOYEES: `${apiServer}/v1/employees`,
    GET_CAMERAS: `${apiServer}/v1/siteControl/cameras`,
    GET_ENTRANCE_EMPLOYEES: `${apiServer}/v1/siteControl/entrance/employees`,
};

const sleep = function (delay) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            console.log(`sleep for ${delay}`);
            resolve(true);
        }, delay);
    });
}

const projectsMap = {
    "-MAuS5IW7OgXn-Os9Ewm": "9000",
    "-LxQvZ4EoTtj_Iooo1dM": "9001",
    "-LjjY-E27b5c1oDCC_As": "9002",
    "-MPj-FbhXK-_vvOn0ntK": "9000",
    "-MQ6EUuczNXd54haAwYQ": "9001",
    "-MQR1ViVk7lMBVkUzU_K": "9002",
    "-MWxCtCrEAFJ16fzsXoF": "9000",
    "-MPj-l1No17zIk437Tih": "9001",
    "-MYj_QQRFSEjnrZTb-W4": "9002",
    "-MUrNi-sgSSxs0CsVG7Z": "9000",
    "-Me4NNN_PjsE8TporaFq": "9001"
};

exports.syncProjects = async () => {
    await Promise.all(
        _.keys(projectsMap)
            .map(async projectId => {
                const port = _.get(projectsMap, [projectId], 8080);

                if (port !== "9000")
                    return;

                const host = `http://localhost:${port}`;

                try {
                    await utils.axios(null, { url: `${host}/v1/siteControl/services/employees/sync?projectId=${projectId}&forceSync=true`, method: 'POST' });
                } catch (error) {
                    debugger;
                    console.log(error);
                }
            })
    );
}

exports.cleanCameras = async (projectId) => {
    try {
        let employeesDirectlyFromCameras = (await axios.get(RESOURCES.GET_EMPLOYEES_FROM_CAMERA + `?projectId=${projectId}`)).data;;
        let cameras = (await axios.get(RESOURCES.GET_CAMERAS + `?projectId=${projectId}`)).data;;

        for (let camera in cameras) {
            let employees = _.get(employeesDirectlyFromCameras, [camera]);

            for (let emp in employees) {
                await axios.delete(`${RESOURCES.DELETE_USER}/${emp}?projectId=${projectId}`);
                await sleep(2000);
            }
        }

        console.log('');

    } catch (error) {
        console.log("TCL ~ file: scripts.js ~ line 141 ~ exports.cleanCameras= ~ error", error)
    }
}

exports.patchSiteControlEmployees = async (projectId, data) => {
    try {
        let SCEmployees = (await axios.get(RESOURCES.GET_SC_EMPLOYEES + `?projectId=${projectId}`)).data;
        SCEmployees = _.values(SCEmployees).filter(emp => Boolean(emp.id));

        let batches = _.chunk(SCEmployees, 50);


        for (let i = 0; i < batches.length; i++) {
            let employeesToDelete = batches[i];

            await Promise.all(
                _.values(employeesToDelete)
                    .map(async (emp) => {
                        if (emp && emp.id && emp.log)
                            await axios.patch(RESOURCES.PATCH_SC_EMPLOYEE + `?projectId=${projectId}`, { id: emp.id, ...data });
                    }));

            await sleep(2000);
        }

        console.log('Finished');
    }
    catch (e) {
        console.log(e.message);
    }
}

exports.findEmployeesWithIsDeletedContribution = async (projectId, data) => {
    try {
        let SCEmployees = (await axios.get(RESOURCES.GET_SC_EMPLOYEES + `?projectId=${projectId}`)).data;
        let EntranceEmployees = (await axios.get(RESOURCES.GET_ENTRANCE_EMPLOYEES + `?projectId=${projectId}&includeDeleted=true`)).data;
        let list = [];

        _.values(SCEmployees)
            .filter(emp => emp.id)
            .filter(emp => emp.isDeleted === true)
            .forEach(emp => {
                if (_.get(EntranceEmployees, [emp.id]) && _.get(EntranceEmployees, [emp.id]).isDeleted !== true)
                    list.push({...emp});
            });

            console.log(list);
    } catch (error) {
        console.log(error);
    }
}
