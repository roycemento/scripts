const axios = require('axios');
const { values } = require('lodash');
const _ = require('lodash');
const utils = require('./Utils');
const apiServer = 'http://localhost:8080';
const puppeteerServer = 'https://pdf.cemento.ai';


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

exports.restoreForms = async (projectId, formType, formTemplateId, unitIds,) => {
    // if (_.isNil(FORM_TYPES[formType]) || _.isEmpty(unitIds) || !formTemplateId)
    //     return;

    projectId = projectId || '-Lnq-7UZueO9qfOAnMpi';
    formTemplateId = formTemplateId || '-MFVDQw_WXlnMGwHh8h7';
    formType = formType || 'general';
    unitIds = ["-MFdqEztg6vyh5F8VcHD", "-MFdqEzuUWzsQsNXKCau", "-MFdqEzzx9ijK4GYXMqb", "-MFdqF-0XIhpGnIobZYi", "-MFdqF-5zwndkXjgA0T4", "-MFdqF-8dPbT57LeAPME"];

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

                if (unitId && unitIdsMap[unitId] && signatures && form.formTemplateId === formTemplateId && _.values(signatures).length) {
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

exports.syncFormsToNewPropertyInstance = async (projectId, formType, formTemplateId, subjectName, lang) => {
    lang = lang || 'he';

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
        let building = { exist: {}, notExist: {} };

        _.values(propertiesInstances)
            .forEach(inst => {
                let data = _.head(_.values(inst.data)) || {};

                if (data.type === 'pdf' && data.uri)
                    _.set(propInstanceMapByPdfURI, [data.uri], true);
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
            .filter(post => {
                let pdf = _.head(_.values(post.attachments)).uri;

                if (_.get(propInstanceMapByPdfURI, [pdf])) {
                    let count = _.get(building, ['exist', _.get(post, 'location.building.id')]) || 1;
                    _.set(building, ['exist', _.get(post, 'location.building.id')], count + 1);
                    return false;
                } else {
                    let count = _.get(building, ['notExist', _.get(post, 'location.building.id')]) || 1;
                    _.set(building, ['notExist', _.get(post, 'location.building.id')], count + 1);
                    return true;
                }

            })
            .filter(post => post.title.includes(title))
            .sort((a, b) => b.updatedTS - a.updatedTS)
            .forEach(post => {
                let unitId = _.get(post, ["location", "unit", "id"]);
                let floorId = _.get(post, ["location", "floor", "id"]);
                let buildingId = _.get(post, ["location", "building", "id"]);

                if (unitId && floorId && buildingId)
                    _.set(finalForms, [buildingId + floorId + unitId], post);
            });

        let batches = _.chunk(_.values(finalForms), 1);

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

                        const parentId = buildingId + floorId + unitId;

                        let propInstanceId = utils.getUniqKey('properties/instances/projects' + projectId + subjectName);

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
                    })
            );

            await utils.threadSleep(3000);
        }
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
