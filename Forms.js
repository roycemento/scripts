const axios = require('axios');
const { values, method } = require('lodash');
const _ = require('lodash');
const utils = require('./Utils');
const apiServer = 'http://localhost:8080';
const puppeteerServer = 'https://pdf.cemento.ai';
const puppeteerServerDev = 'http://localhost:8988';

// 'http://localhost:8988';
// || 'https://pdf.cemento.ai';


const RESOURCES = {
    GET_FORMS: `${apiServer}/v1/forms`,
    GENERATE_PDF: `${puppeteerServer}/pdf`,
    DYNAMIC_LINK: `https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=AIzaSyDwfY0RE6V3ILCeV-CPLgnhxYQXA4qFAUM`
};

const FORM_TYPES = {
    general: 'general',
    safety: 'safety',
    other: 'other'
};

exports.summarySafetyReport = async (projects) => {
    if (!projects)
        return;

    let restoredFormsUrls = [];
    let formType = "temp";

    for (let projectId of projects) {
        try {
            let projectData = (await axios.get(`${apiServer}/v1/projects?projectId=${projectId}`)).data;
            let projectName = _.get(projectData, [projectId, 'title'], projectId);

            let newForm = (await axios.post(`${apiServer}/v1/forms`, {
                projectId,
                type: formType,
                skipEmail: true,
                reportDate: 1616889600000,
                "formTemplateId": "-safetySummeryReport",
                formStartTS: 1616889600000,
                readyToGenerateTS: 1616889600000
            })).data

            let formId = _.get(newForm, ['id']);
            let body = { projectId, formId, formType };
            let generatedForm = (await axios.post(RESOURCES.GENERATE_PDF, body)).data;

            if (generatedForm && generatedForm.uri) {
                let dynamicLinkRes = (await axios.post(RESOURCES.DYNAMIC_LINK,
                    {
                        "dynamicLinkInfo": {
                            "domainUriPrefix": "https://cemento.page.link",
                            "link": generatedForm.uri,
                        }
                    })).data;

                let shortLink = dynamicLinkRes ? dynamicLinkRes.shortLink : null;

                if (shortLink)
                    restoredFormsUrls.push({ projectName, shortLink });
            }

            await utils.threadSleep(3000);
        }
        catch (error) {
            console.log("TCL ~ file: Forms.js ~ line 20 ~ exports.restoreForms= ~ error", error)
        }
    }

    console.log(restoredFormsUrls)
    console.log(JSON.stringify(restoredFormsUrls));
}

exports.restoreForms = async (projectId, formType, formTemplateId, unitIds,) => {
    // if (_.isNil(FORM_TYPES[formType]) || _.isEmpty(unitIds) || !formTemplateId)
    //     return;

    if (!projectId || !formType || !formTemplateId || !unitIds)
        return;
    let unitIdsMap = _.mapKeys(unitIds);
    let formsToRestores = {};
    let restoredFormsUrls = [];

    try {
        let forms = (await axios.get(RESOURCES.GET_FORMS + `?projectId=${projectId}&formType=${formType}`)).data;

        _.values(forms)
            .forEach(form => {
                const { signatures, location, type, id } = form;
                const unitId = location ? location.unitId : null;
                let body = { formType, projectId };

                if (unitId && unitIdsMap[unitId] && form.formTemplateId === formTemplateId) {
                    if (!formsToRestores[unitId])
                        formsToRestores[unitId] = { ...body, formId: id, numberOfSignatures: values(signatures).length };
                    else {
                        if (formsToRestores[unitId].numberOfSignatures < _.values(signatures).length)
                            formsToRestores[unitId] = { ...body, formId: id, numberOfSignatures: values(signatures).length };
                    }
                }
            });

        formsToRestores = _.values(formsToRestores);

        for (let i = 0; i < formsToRestores.length; i++) {
            try {
                let formReqBody = formsToRestores[i];
                let generatedForm = (await axios.post(RESOURCES.GENERATE_PDF, formReqBody)).data;

                if (generatedForm && generatedForm.uri) {
                    let dynamicLinkRes = (await axios.post(RESOURCES.DYNAMIC_LINK,
                        {
                            "dynamicLinkInfo": {
                                "domainUriPrefix": "https://cemento.page.link",
                                "link": generatedForm.uri,
                            }
                        })).data;

                    let shortLink = dynamicLinkRes ? dynamicLinkRes.shortLink : null;

                    if (shortLink)
                        restoredFormsUrls.push(shortLink);
                }
            } catch (error) {
                console.log("Failed to restore form.", { error, formReqBody });
            }
        }

        console.log(restoredFormsUrls)
        console.log(JSON.stringify(restoredFormsUrls));

    } catch (error) {
        console.log("TCL ~ file: Forms.js ~ line 20 ~ exports.restoreForms= ~ error", error)
    }
}

exports.regenerateForms = async (projectId, formType) => {
    let formsToRegenerate = await utils.axios(null, { url: `${apiServer}/v1/forms?projectId=${projectId}&formType=safety`, method: 'GET' });
    formType = 'safety';

    for (let formId in formsToRegenerate) {
        let currForm = formsToRegenerate[formId];

        try {
            if (currForm.id)
                await utils.axios(null, { method: 'POST', url: `${puppeteerServerDev}/pdf`, data: { projectId, formType, formId: currForm.id } });
        } catch (error) {
            console.log('error', { error });
        }
    }
}


exports.syncFormsToNewPropertyInstance = async (projectId, universalId, subjectName, lang, dateUniversalId) => {
    lang = lang || 'he';

    try {
        let projectMergedTemplates = await utils.axios(null, { url: `${apiServer}/v1/services/templates/getMerged?scope=projects&scopeId=${projectId}&templateSubject=configurations`, method: 'GET' });
        let projectForms = _.get(projectMergedTemplates, ['configurations', 'forms'], {});
        let template;

        _.forIn(projectForms, (form, formId) => {
            if (_.get(form, ['universalIds', universalId]))
                template = form;
        });

        if (!template)
            return;

        let title = _.get(template, ['title', lang], null);
        title = title ? _.head(title.split('-')).toString().trim() : '';

        let [propertiesInstances, posts, propertyTypes] = await Promise.all([
            utils.axios(null, { url: `${apiServer}/v1/propertiesInstances?subjectName=${subjectName}&projectId=${projectId}`, method: 'GET' }),
            utils.axios(null, { url: `${apiServer}/v1/posts?projectId=${projectId}`, method: 'GET' }),
            utils.axios(null, { url: `${apiServer}/v1/properties?projectId=${projectId}&subjectName=${subjectName}`, method: 'GET' })
        ]);

        propertyTypes = _.get(propertyTypes, ["properties"])

        let propInstanceMapByPdfURI = {};
        let requestedPropType = _.values(propertyTypes).find(prop => prop.universalId === universalId);
        let propType = _.get(requestedPropType, ['type']);
        let propId = _.get(requestedPropType, ['id']);

        let dateProperty = {};

        _.forIn(propertyTypes, (val, key) => {
            if (val && val["universalId"] && val["universalId"] === dateUniversalId) {
                dateProperty = {
                    propType: 'Date',
                    propId: key,
                };
            }
        });

        _.forIn(propertiesInstances, (val, key) => {
            let { type, uri } = _.head(_.values(val.data)) || {};

            if (type === 'pdf' && uri)
                _.set(propInstanceMapByPdfURI, [uri], true);
        });

        let dbUpdates = {};

        _.forIn(posts, (post, postId) => {
            if (post && post.title && post.title.includes(title) && post.updatedTS && post.id && post.attachments) {
                const { attachments, createdAt } = post;
                let pdf = _.head(_.values(attachments))
                let uri = _.get(pdf, ["uri"], null);

                let unitId = _.get(post, ["location", "unit", "id"]);
                let floorId = _.get(post, ["location", "floor", "id"]);
                let buildingId = _.get(post, ["location", "building", "id"]);

                let datePropId = utils.getUniqKey(`properties/instances/projects/${projectId}/${subjectName}`);
                let currentDatePropData = { ...dateProperty, data: createdAt, updatedTS: Date.now(), parentId: unitId, id: datePropId };

                if (_.get(propInstanceMapByPdfURI, [uri]))
                    return;

                let id = utils.getUniqKey('properties/instances/projects' + projectId + subjectName);

                if (unitId && floorId && buildingId) {
                    let data = {
                        data: [{
                            contentTypeId: "doc",
                            type: "pdf",
                            updatedTS: Date.now(),
                            uri: uri
                        }],
                        updatedTS: Date.now(),
                        parentId: unitId,
                        propId,
                        propType,
                        id
                    };
                    count2++;

                    _.set(dbUpdates, `properties/instances/projects/${projectId}/${subjectName}/${id}`, data);
                    _.set(dbUpdates, `properties/instances/projects/${projectId}/${subjectName}/${datePropId}`, currentDatePropData);
                }
            }
        });
        debugger;

        await utils.createObjOnFireBase(dbUpdates);

        debugger;
    }
    catch (error) {
        console.log("TCL ~ file: Forms.js ", error)
    }
}

exports.fix = async (projectId, formType, formTemplateId, subjectName, lang) => {
    try {
        let [propertiesInstances, posts, template, propertyTypes] = await Promise.all([
            axios.get(`${apiServer}/v1/propertiesInstances?subjectName=${subjectName}&projectId=${projectId}`),
            axios.get(`${apiServer}/v1/posts?projectId=${projectId}`),
            axios.get(`${apiServer}/v1/configurations?scope=projects&scopeId=${projectId}&ids=["${formTemplateId}"]&confSubj=forms`),
            axios.get(`${apiServer}/v1/properties?projectId=${projectId}&subjectName=${subjectName}`)
        ]);

        propertiesInstances = propertiesInstances.data;
        posts = posts.data;
        template = template.data;
        propertyTypes = _.get(propertyTypes, ["data", "properties"])

        let propInstanceMapByPdfURI = {};

        _.values(propertiesInstances)
            .forEach(inst => {
                let data = _.head(_.values(inst.data)) || {};

                if (data.type === 'pdf' && data.uri)
                    _.set(propInstanceMapByPdfURI, [data.uri], inst);
            });

        if (!template)
            throw new Error();

        template = _.get(template, [formTemplateId]);

        let { universalIds, title } = template;

        title = title[lang];
        title = _.head(title.split('-')).toString().trim();

        let universalId = _.head(_.values(universalIds));
        let requestedPropType = _.values(propertyTypes).find(prop => prop.universalId === universalId);
        let propType = _.get(requestedPropType, ['type']);
        let propId = _.get(requestedPropType, ['id']);
        let finalForms = {};

        _.values(posts)
            .filter(post => post && post.updatedTS && post.id && post.attachments)
            .filter(post => post.title.includes(title))
            .sort((a, b) => b.updatedTS - a.updatedTS)
            .forEach(post => {
                let pdf = _.head(_.values(post.attachments))
                let uri = _.get(pdf, ["uri"], null);

                let unitId = _.get(post, ["location", "unit", "id"]);
                let floorId = _.get(post, ["location", "floor", "id"]);
                let buildingId = _.get(post, ["location", "building", "id"]);

                if (unitId && floorId && buildingId)
                    _.set(finalForms, [uri], post);
            });

        let batches = _.chunk(_.values(finalForms), 25);

        for (let batch of batches) {

            await Promise.all(
                batch.map(
                    async (form) => {
                        const { attachments } = form;
                        let pdf = _.head(_.values(attachments))
                        let uri = _.get(pdf, ["uri"], null);

                        let unitId = _.get(form, ["location", "unit", "id"]);
                        let floorId = _.get(form, ["location", "floor", "id"]);
                        let buildingId = _.get(form, ["location", "building", "id"]);

                        if (!buildingId || !floorId || !unitId)
                            return;

                        if (_.get(propInstanceMapByPdfURI, [uri])) {
                            const { id } = _.get(propInstanceMapByPdfURI, [uri]);
                            const parentId = unitId;
                            let propInstanceId = id;

                            if (parentId && propInstanceId && uri) {
                                let data = {
                                    data: [{
                                        contentTypeId: "doc",
                                        type: "pdf",
                                        updatedTS: Date.now(),
                                        uri: uri
                                    }],
                                    updatedTS: Date.now(),
                                    parentId,
                                    propId,
                                    propType,
                                    id: propInstanceId,
                                };

                                let dbUpdates = {};
                                _.set(dbUpdates, `properties/instances/projects/${projectId}/${subjectName}/${propInstanceId}`, data);

                                await utils.createObjOnFireBase(dbUpdates);
                            }
                        }
                    })
            );

            await utils.threadSleep(5000);
        }
    }
    catch (error) {
        console.log("TCL ~ file: Forms.js ", error)
    }
}
