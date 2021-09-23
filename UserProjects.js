const utils = require('./Utils');
const _ = require('lodash');

exports.removeMembers = async (projectId) => {
    projectId = "-MFPgBfLMxC5KOtWIvht";

    let dbUpdates = {};
    let projectIdsToRemoveFromUsersProjects = [
        "-MeKktfMASZ3zhtpEVpr",
        "-MeKktjEl0U_uZdF91Vd",
        "-MeKktnJsdTbJyk7MURV",
        "-MeKktqvq2RpcWmGPDuZ",
        "-MeKktuALKgiBzc68j9f",
        "-MeKktxRigvl9vEaRg9C",
        "-MeKku0t09lqPanIPO7a",
        "-MeKkzqr1k6d1bWAXDl4",
        "-MeKkzuIptdn3VgKE7fH",
        "-MeKl-0LQ-MI3D0jSu3L",
        "-MeKl-3uD5Pvnp3nIZ7q",
        "-MeKl-7eX7bweQXFa-iE",
        "-MeKl-Ah3kw3S6zOH-5R",
        "-MeKl-Ds9lBAUVS0tBuE",
    ];


    try {
        let members = await utils.getCollection(`projects/${projectId}/members`) || {};

        for (let memberId in members)
            projectIdsToRemoveFromUsersProjects.forEach(id => _.set(dbUpdates, [`users-projects/${memberId}/${id}`], null));

        await utils.firebaseUpdate(dbUpdates);
        console.log('Update users-projects');
    } catch (error) {
        console.log(error);
    }
}