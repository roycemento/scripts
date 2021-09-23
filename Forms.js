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
    GENERATE_PDF: `${puppeteerServerDev}/pdf`,
    DYNAMIC_LINK: `https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=AIzaSyDwfY0RE6V3ILCeV-CPLgnhxYQXA4qFAUM`
};

const FORM_TYPES = {
    general: 'general',
    safety: 'safety',
    other: 'other',
    certification: 'certification'
};

let MAX_RETRIES = 15;

exports.regenerateCertificationsFormsMissingEmployeeInfo = async () => {
    let projectsIds = await utils.getCollection('projects');
    let counter = 0;


    for (let projectId in projectsIds) {
        let currProjectCertificationsForms = await
            utils.axios(null, { url: `${apiServer}/v1/forms?projectId=${projectId}&formType=${FORM_TYPES.certification}` })
                .catch(error => console.log('Failed to fetch forms', { error }));

        for (let currFormId in currProjectCertificationsForms) {
            let dbUpdates = {};
            let updatedTSDbUpdates = {};

            let shouldRegenerateForm;
            let reportDate;

            let currForm = currProjectCertificationsForms[currFormId];
            let formCertifications = currForm.certifications || {};


            for (let certId in formCertifications) {
                let currCert = formCertifications[certId] || {};
                let { employee, creationDate } = _.get(currCert, ['certificationInfo'], {});

                if (!employee || (!employee.idNumber && !employee.name)) {

                    shouldRegenerateForm = true;
                    reportDate = creationDate;

                    let universalIdToKeyInCertInfo = { "fullName": "name", "idNumber": "idNumber" };
                    let missingFields = [];

                    _.forIn(universalIdToKeyInCertInfo, (keyInCertInfo, universalId) => {
                        let val = _.get(employee, [keyInCertInfo]);

                        if (_.isNil(val) || val == '')
                            missingFields.push(universalId);
                    });

                    let certInstance = await utils.axios(null, { url: `${apiServer}/v1/propertiesInstances/${certId}?projectId=${projectId}&subjectName=employeesInfo`, method: 'GET' });
                    let parentId = certInstance.parentId;
                    let missingData = await utils.axios(null, { url: `${apiServer}/v1/propertiesInstances?parentId=${parentId}&projectId=${projectId}&subjectName=employeesInfo&universalIds=${JSON.stringify(missingFields)}&universalIdsMode=true`, method: 'GET' });

                    if (_.isEmpty(missingData))
                        shouldRegenerateForm = false;

                    _.forIn(missingData, (instance, universalId) => {
                        _.set(dbUpdates, [`forms/${projectId}/full/certification/${currFormId}/certifications/${certId}/certificationInfo/employee/${universalIdToKeyInCertInfo[universalId]}`], instance.data);
                    });

                    _.set(updatedTSDbUpdates, [`forms/${projectId}/full/certification/${currFormId}/updatedTS`], Date.now());
                }
            }

            if (shouldRegenerateForm && reportDate) {
                let data = { reportDate, projectId, formType: FORM_TYPES.certification, formId: currFormId };

                for (let i = 0; i < MAX_RETRIES; i++) {
                    try {
                        let ret = await utils.axios(null, { url: RESOURCES.GENERATE_PDF, method: 'POST', data });
                        await utils.updatesOnFirebaseDb(dbUpdates);
                        await utils.updatesOnFirebaseDb(updatedTSDbUpdates);
                        console.log(`Regenerate form was succeeded.`, data);
                        counter++;
                        break;
                    }
                    catch (error) {
                        await utils.threadSleep(1000);
                        console.log(`Regenerate form was failed.`, data);
                    }
                }
            }
        }

        console.log(counter);
    }

    debugger;
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


exports.syncFormsToNewPropertyInstance = async (projectId, universalId, subjectName, lang, dateUniversalId, formTitle) => {
    lang = lang || 'he';
    let count = 0;

    try {
        let projectMergedTemplates = await utils.axios(null, { url: `${apiServer}/v1/services/templates/getMerged?scope=projects&scopeId=${projectId}&templateSubject=configurations`, method: 'GET' });
        let projectForms = _.get(projectMergedTemplates, ['configurations', 'forms'], {});
        let template;

        _.forIn(projectForms, (form, formId) => {
            if (_.get(form, ['universalIds', universalId])) {
                if (_.get(form, ['title', lang]) === formTitle)
                template = form;
            }
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
                    count++;

                    _.set(dbUpdates, `properties/instances/projects/${projectId}/${subjectName}/${id}`, data);

                    if (!_.isEmpty(dateProperty))
                        _.set(dbUpdates, `properties/instances/projects/${projectId}/${subjectName}/${datePropId}`, currentDatePropData);
                }
            }
        });

        debugger;

        await utils.firebaseUpdate(dbUpdates);

        debugger;
    }
    catch (error) {
        console.log("TCL ~ file: Forms.js ", error)
    }
}

exports.fix = async () => {
    const projectIds = [
        "-MeKktfMASZ3zhtpEVpr",
        "-MeKkzqr1k6d1bWAXDl4",
        "-MeKktfMASZ3zhtpEVpr",
        "-MeKktjEl0U_uZdF91Vd",
        "-MeKkzuIptdn3VgKE7fH",
        "-MeKktnJsdTbJyk7MURV",
        "-MeKl-0LQ-MI3D0jSu3L",
        "-MeKl-0LQ-MI3D0jSu3L",
        "-MeKktqvq2RpcWmGPDuZ",
        "-MeKl-3uD5Pvnp3nIZ7q",
        "-MeKktuALKgiBzc68j9f",
        "-MeKl-7eX7bweQXFa-iE",
        "-MeKktxRigvl9vEaRg9C",
        "-MeKl-Ah3kw3S6zOH-5R",
        "-MeKku0t09lqPanIPO7a",
        "-MeKl-Ds9lBAUVS0tBuE"
    ];

    try {
        let counter = 0;
        let dbUpdates = {};

        for (let i = 0; i < projectIds.length; i++) {
            let projectId = projectIds[i];
            let isProjectExist = await utils.axios(`${apiServer}/v1/projects?projectId=${projectId}`);

            if (!isProjectExist || _.isEmpty(isProjectExist)) {
                _.set(dbUpdates, [`forms/${projectId}`], null);
                counter++;
            }
        }

        debugger;
        await utils.firebaseUpdate(dbUpdates);

        console.log(counter);

        // let [propertiesInstances, posts, template, propertyTypes] = await Promise.all([
        //     axios.get(`${apiServer}/v1/propertiesInstances?subjectName=${subjectName}&projectId=${projectId}`),
        //     axios.get(`${apiServer}/v1/posts?projectId=${projectId}`),
        //     axios.get(`${apiServer}/v1/configurations?scope=projects&scopeId=${projectId}&ids=["${formTemplateId}"]&confSubj=forms`),
        //     axios.get(`${apiServer}/v1/properties?projectId=${projectId}&subjectName=${subjectName}`)
        // ]);

        // propertiesInstances = propertiesInstances.data;
        // posts = posts.data;
        // template = template.data;
        // propertyTypes = _.get(propertyTypes, ["data", "properties"])

        // let propInstanceMapByPdfURI = {};

        // _.values(propertiesInstances)
        //     .forEach(inst => {
        //         let data = _.head(_.values(inst.data)) || {};

        //         if (data.type === 'pdf' && data.uri)
        //             _.set(propInstanceMapByPdfURI, [data.uri], inst);
        //     });

        // if (!template)
        //     throw new Error();

        // template = _.get(template, [formTemplateId]);

        // let { universalIds, title } = template;

        // title = title[lang];
        // title = _.head(title.split('-')).toString().trim();

        // let universalId = _.head(_.values(universalIds));
        // let requestedPropType = _.values(propertyTypes).find(prop => prop.universalId === universalId);
        // let propType = _.get(requestedPropType, ['type']);
        // let propId = _.get(requestedPropType, ['id']);
        // let finalForms = {};

        // _.values(posts)
        //     .filter(post => post && post.updatedTS && post.id && post.attachments)
        //     .filter(post => post.title.includes(title))
        //     .sort((a, b) => b.updatedTS - a.updatedTS)
        //     .forEach(post => {
        //         let pdf = _.head(_.values(post.attachments))
        //         let uri = _.get(pdf, ["uri"], null);

        //         let unitId = _.get(post, ["location", "unit", "id"]);
        //         let floorId = _.get(post, ["location", "floor", "id"]);
        //         let buildingId = _.get(post, ["location", "building", "id"]);

        //         if (unitId && floorId && buildingId)
        //             _.set(finalForms, [uri], post);
        //     });

        // let batches = _.chunk(_.values(finalForms), 25);

        // for (let batch of batches) {

        //     await Promise.all(
        //         batch.map(
        //             async (form) => {
        //                 const { attachments } = form;
        //                 let pdf = _.head(_.values(attachments))
        //                 let uri = _.get(pdf, ["uri"], null);

        //                 let unitId = _.get(form, ["location", "unit", "id"]);
        //                 let floorId = _.get(form, ["location", "floor", "id"]);
        //                 let buildingId = _.get(form, ["location", "building", "id"]);

        //                 if (!buildingId || !floorId || !unitId)
        //                     return;

        //                 if (_.get(propInstanceMapByPdfURI, [uri])) {
        //                     const { id } = _.get(propInstanceMapByPdfURI, [uri]);
        //                     const parentId = unitId;
        //                     let propInstanceId = id;

        //                     if (parentId && propInstanceId && uri) {
        //                         let data = {
        //                             data: [{
        //                                 contentTypeId: "doc",
        //                                 type: "pdf",
        //                                 updatedTS: Date.now(),
        //                                 uri: uri
        //                             }],
        //                             updatedTS: Date.now(),
        //                             parentId,
        //                             propId,
        //                             propType,
        //                             id: propInstanceId,
        //                         };

        //                         let dbUpdates = {};
        //                         _.set(dbUpdates, `properties/instances/projects/${projectId}/${subjectName}/${propInstanceId}`, data);

        //                         await utils.createObjOnFireBase(dbUpdates);
        //                     }
        //                 }
        //             })
        //     );

        //     await utils.threadSleep(5000);
        // }
    }
    catch (error) {
        console.log("TCL ~ file: Forms.js ", error)
    }
}

exports.DonaAndGilScript = async () => {
    let donaProjects = await utils.axios(null, { url: `${apiServer}/v1/projects?companyId=vLe3hnlV21t8ytRQjppz`, method: 'GET' });
    let projectsWithSafetyFeature = await utils.axios(null, { url: `${apiServer}/v1/services/templates/getMergedByPath?templateSubject=configurations&path=features/safety/isActive`, method: 'GET' });

    donaProjects = _.pickBy(donaProjects, (val, key) => _.get(projectsWithSafetyFeature, [key]));

    let ret = {};

    for (let projectId in donaProjects) {
        let projectTitle = _.get(donaProjects, [projectId, 'title']);
        let currForms = await utils.axios(null, { url: `${apiServer}/v1/forms?projectId=${projectId}&formType=temp`, method: 'GET' });
        currForms = _.pickBy(currForms, (val, key) => val.formTemplateId === '-safetySummeryReport');

        _.forIn(currForms, (val, key) => {
            if (val.updatedTS > 1623067233000)
                _.set(ret, [projectId], { uri: val.uri, projectName: projectTitle });
        })
    }

    debugger;
}
