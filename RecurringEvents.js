const moment = require('moment');
const utils = require('./Utils');
const _ = require('lodash');
const firebaseKey = require('firebase-key');
const apiServer = 'http://localhost:8080';

exports.disableNotMigratedProjects = async () => {
    let dbUpdates = {};

    try {
        let companies = await utils.getCollection(`recurringEvents/defintions/companies`) || {};
        const migratedProjects = await utils.getCollection(`_internal/pinkasClaliMigratedProjects`) || {};

        companies = _.pickBy(companies, (events, companyId) => {
            const shouldFilterIn = Boolean(_.get(events, ['safetySummeryReport']));
            return shouldFilterIn;
        })

        await Promise.all(
            _.keys(companies)
                .map(async companyId => {
                    const projects = await utils.axios(null, { url: `https://api.cemento.ai/v1/projects?companyId=${companyId}` }) || {};

                    await Promise.all(
                        _.keys(projects)
                            .map(async projectId => {
                                let wasProjectsMigrated = Boolean(_.get(migratedProjects, [projectId]));
                                let wasDoneAlready = await utils.getCollection(`recurringEvents/defintions/projects/-MTAgyCO11uphbUEHhx8/safetySummeryReport`) || {};

                                if (!wasProjectsMigrated && wasDoneAlready.enable !== false)
                                    _.set(dbUpdates, [`recurringEvents/defintions/projects/${projectId}/safetySummeryReport/enable`], false);
                            }))

                }));

        debugger;

        await utils.firebaseUpdate(dbUpdates);
    } catch (error) {
        debugger;
    }
}

exports.test = async () => {
    let emailsMap = {};
    let companiesMap = {};

    let dbUpdates = {};

    let [projects, projectsObjects] = await Promise.all([
        utils.getCollection(`backups/01-09-2021/templates/configurations/projects`),
        utils.getCollection(`projects`),
    ]);

    _.forIn(projectsObjects, (project, projectId) => {
        let companyId = _.get(project, ['companyId']);

        if (companyId)
            _.set(companiesMap, [companyId, projectId], projectId);
    });

    _.forIn(projects, (projectConfig, projectId) => {
        let targetEmails = _.get(projectConfig, ['forms', '-safetySummeryReport', 'targetEmails']);
        let companyId = _.get(projectsObjects, [projectId, 'companyId']);

        _.forIn(targetEmails, (email, emailKey) => {
            _.set(emailsMap, [companyId, email, projectId], email);
        });
    });

    _.forIn(emailsMap, (emails, companyId) => {
        _.forIn(emails, (projects, email) => {
            const encodedEmail = firebaseKey.encode(email);
            const companyNumberOfProjects = _.values(_.get(companiesMap, [companyId])).length;

            if (companyNumberOfProjects > 1 && companyNumberOfProjects === _.values(projects).length)
                _.set(dbUpdates, [`recurringEvents/defintions/companies/${companyId}/safetySummeryReport/formTemplatesIds/-safetySummeryReport/targetEmails/${encodedEmail}`], email);
            else
                _.keys(projects).forEach(projectId => _.set(dbUpdates, [`recurringEvents/defintions/projects/${projectId}/safetySummeryReport/formTemplatesIds/-safetySummeryReport/targetEmails/${encodedEmail}`], email));
        });
    })

    await utils.firebaseUpdate(dbUpdates);
}