const utils = require('./Utils');
const axios = require('axios');
const _ = require('lodash');
const { method } = require('lodash');

const apiServerDev = 'http://localhost:8080';
const apiServerProd = 'https://api-dot-planme-1383.appspot.com';

exports.addAppendix = async (projectId, formId, images) => {
    if (!_.isArray(images) || !projectId || !formId)
        return;

    const storagePath = `/appendix/projects/${projectId}/forms/${formId}/images`;

    let dbUpdates = {};
    let path = `templates/configurations/projects/${projectId}/forms/${formId}/appendix/images`;

    images.forEach((val, index) => _.set(dbUpdates, [`${path}/appendix_${index + 1}`], { uri: val, id: `appendix_${index + 1}` }));
    await utils.createObjOnFireBase(dbUpdates);
    await axios({ url: `${apiServerDev}/v1/services/templates/merge?scope=projects&scopeId=${projectId}&templateSubject=configurations`, method: 'GET' });
}

const TEMPLATES_SAFETY_FORMS = {
    "-LsqatzusgiQtor747EM": "-LsqatzusgiQtor747EM",
    "-LsqatzusgiQtor747EZ": "-LsqatzusgiQtor747EZ",
}

const UNIVERSAL_IDS_MAP = {
    safetyAssistant: {
        "ת.ז.": 'safetyAssistantIdNumber',


    },
    foreman: {
        idNumber: '',
        name: '',

    }
}
exports.updateSafetyTagListClones = async (ids) => {
    const safetyAssistantUniversalId = "safetyAssistantDailyTagList";

    let projectsId = ids ? ids : await utils.axios(null, { url: `${apiServerDev}/v1/services/templates/getMergedByPath?templateSubject=configurations&path=features/safety/isActive` });
    projectsId = _.keys(projectsId);
    let temp = {};

    for (let i = 0; i < projectsId.length; i++) {
        try {
            let currProjectId = projectsId[i];
            let projectGetMerged = await utils.axios(null, { url: `${apiServerDev}/v1/services/templates/getMerged?scope=projects&scopeId=${projectsId[i]}&templateSubject=configurations`, method: 'GET' });
            let projectForms = _.get(projectGetMerged, ["configurations", "forms"], {});
            let dbUpdates = {};

            for (let formTemplateId in projectForms) {
                if (_.get(TEMPLATES_SAFETY_FORMS, [formTemplateId]))
                    continue;

                let currForm = projectForms[formTemplateId];
                let formIsSafetyAssistantTagList = _.get(currForm, ['universalIds', safetyAssistantUniversalId]);

                if (formIsSafetyAssistantTagList) {
                    _.set(temp, [currProjectId], currProjectId);
                }
            }

        } catch (error) {
            console.log(error);
        }
    }

    console.log(temp);
}