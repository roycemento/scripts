const axios = require('axios');
const _ = require('lodash');

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
