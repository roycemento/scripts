const moment = require('moment');
const utils = require('./Utils');
const _ = require('lodash');
const firebaseKey = require('firebase-key');

const apiServer = 'http://localhost:8080';

const ACTIONS = {
    send: 'send',
    regenerate: 'regenerate'
}

const regenerate = async () => {
    const today = moment().set({ hour: 0, minute: 0, second: 0 });
    const events = await utils.getCollection('internal/recurringEvents/generateForm/safetySummeryReport');
    const todayEvents = _.pickBy(events, (value, eventTS) => eventTS > today);

    let emailsMap = {};
    let companiesMap = {};

    const dbUpdates = {};
    for (let eventTS in todayEvents) {
        const projectsMap = todayEvents[eventTS] || {};

        for (projectId in projectsMap) {
            try {
                const { formType, formId, targetEmails } = projectsMap[projectId] || {};
                let { uri, readyToGenerateTS } = await utils.getCollection(`forms/${projectId}/full/${formType}/${formId}`) || {};
                let { title: projectName, companyId } = await utils.getCollection(`projects/${projectId}`) || {};
                let companyName = _.get(await utils.axios(null, { url: `http://localhost:8080/v1/companies/${companyId}` }), [companyId, 'name']);

                if (!uri) {
                    _.set(companiesMap, [companyId, projectId], { formId, formType, projectId, companyName });
                    _.set(dbUpdates, [`internal/queues/forms/${projectId}_${formId}`], { retriesCounter: 0, formId, formType, projectId, readyToGenerateTS, id: `${projectId}_${formId}` });
                    _.forIn(targetEmails, (email, emailKey) => {
                        _.set(emailsMap, [emailKey, projectId], { formId, formType, projectName, projectId });
                    });
                }

            } catch (error) {
                console.log(error);
            }
        }
    }

    _.set(dbUpdates, [`_internal/recurringEvents/${Date.now()}`], map);

    debugger;
    await utils.firebaseUpdate(dbUpdates)
}

const send = async (ts) => {
    const emailsMap = await utils.getCollection(`_internal/recurringEvents/${ts}`);
    const emailsMapToSend = {};
    const forms = {};
    let formToCreateCounter = 0;
    let projectsMap = {};

    for (let emailKey in emailsMap) {
        const email = firebaseKey.decode(emailKey);
        const projects = emailsMap[emailKey];

        for (let projectId in projects) {
            const { formId, formType, projectName } = projects[projectId];

            if (!_.get(forms, [projectId, formId])) {
                let { uri } = await utils.getCollection(`forms/${projectId}/full/${formType}/${formId}`) || {};

                if (!uri)
                    formToCreateCounter++;
                else
                    _.set(forms, [projectId, formId], uri);
            }

            _.set(projectsMap, [projectId], projectId);
            _.set(emailsMapToSend, [email, 'safetySummeryReport', projectId], { formId, uri: _.get(forms, [projectId, formId]), formType, projectName, projectId })
        }
    }

    debugger;

    await Promise.all(
        _.keys(emailsMapToSend)
            .map(async email => {
                const events = _.get(emailsMapToSend, [email], {});

                await Promise.all(_.keys(events)
                    .map(async eventName => {
                        let projectsMap = _.get(events, [eventName]);

                        if (!_.isEmpty(projectsMap)) {
                            try {
                                await utils.axios(null, {
                                    url: `https://api.cemento.ai/v1/services/email/send/recurringEvents`,
                                    method: 'POST',
                                    data: {
                                        event: eventName,
                                        emailAddress: email,
                                        projectsMap
                                    }
                                })
                            } catch (error) {
                                debugger;
                                console.log(error);
                            }
                        }
                    }));
            }));
}

exports.recurringEventsScript = async (action, ts) => {
    switch (action) {
        case ACTIONS.regenerate:
            await regenerate();
            break;
        case ACTIONS.send:
            await send(ts);
            break;
        default:
            break;
    }
}

exports.moveTargetEmailsToRecurringEvents = async () => {
    const allProjectConfigurations = await utils.getCollection(`configurations/projects`);
    const allProjects = await utils.getCollection(`projects`);

    let map = {};
    let dbUpdates = {};
    let templatesUpdates = {};
    let projectToRunMerger = {};

    // const recurringEventsPath = 

    _.forIn(allProjectConfigurations, (currProject, projectId) => {
        _.forIn(currProject.forms, (form, formTemplateId) => {
            if (formTemplateId === '-safetySummeryReport') {
                const { targetEmails } = form || {};
                const companyId = _.get(allProjects, [projectId, 'companyId']);

                if (targetEmails && companyId)
                    _.set(map, [companyId, projectId], targetEmails);
            }
        });
    })

    _.forIn(map, (projects, companyId) => {
        let amountOfProjects = _.values(projects).length;
        let bucket = {};

        _.forIn(projects, (targetEmails, projectId) => {
            _.forIn(targetEmails, (val, key) => {
                _.set(bucket, [key], _.get(bucket, [key], 0) + 1);
            })
        })

        _.forIn(projects, (targetEmails, projectId) => {
            _.forIn(targetEmails, (email, key) => {
                const isCompanyLevel = _.get(bucket, [key]) === amountOfProjects;
                const encodeEmail = firebaseKey.encode(email);

                _.set(templatesUpdates, [`templates/configurations/projects/${projectId}/forms/-safetySummeryReport/targetEmails/${key}`], null);
                _.set(projectToRunMerger, [projectId], projectId);

                if (isCompanyLevel)
                    _.set(dbUpdates, [`recurringEvents/defintions/companies/${companyId}/safetySummeryReport/formTemplatesIds/-safetySummeryReport/targetEmails/${encodeEmail}`], email);
                else
                    _.set(dbUpdates, [`recurringEvents/defintions/projects/${projectId}/safetySummeryReport/formTemplatesIds/-safetySummeryReport/targetEmails/${encodeEmail}`], email);
            })
        })
    })
    debugger;

    await utils.firebaseUpdate(dbUpdates);
    await utils.firebaseUpdate(templatesUpdates);

    debugger;

    let batches = _.chunk(_.values(projectToRunMerger), 5);

    for (let i = 0; i < batches.length; i++) {
        await Promise.all(
            batches[i].map(async projectId => {
                try {
                    await utils.axios(null, { url: `${apiServer}/v1/services/templates/merge?scope=projects&scopeId=${projectId}&templateSubject=configurations` });
                } catch (error) {
                    console.log('error', error);
                }
            })
        )
    }

    debugger;
}

exports.analyze = async () => {
    let projectsWithoutPinkasClali = {};
    let dbUpdates = {};

    try {
        const formsQueue = await utils.getCollection('internal/queues/forms');
        const migratedProjects = await utils.getCollection(`_internal/pinkasClaliMigratedProjects`);

        await Promise.all(_.values(formsQueue).map(async form => {
            const { formId, formType, projectId, id } = form || {};

            if (formType === 'temp') {
                const { formTemplateId } = await utils.getCollection(`forms/${projectId}/full/${formType}/${formId}`) || {};

                if (formTemplateId === '-safetySummeryReport') {

                    if (!_.get(migratedProjects, [projectId]))
                        _.set(projectsWithoutPinkasClali, [projectId], projectId);

                    _.set(dbUpdates, [`internal/queues/forms/${id}`], null);
                }
            }
        }));

        debugger;
    } catch (error) {
        debugger;
        console.log(error);
    }
}