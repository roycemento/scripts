const axios = require('axios');
const _ = require('lodash');
const apiServer = 'http://localhost:8080';
const Trades = require('./trades.json');
const utils = require('./Utils');

const RESOURCES = {
    GET_PROJECTS_BY_COMPANY: `${apiServer}/v1/projects`,
    GET_POSTS_BY_PROJECT: `${apiServer}/v1/posts`,
    PATCH_POST: `${apiServer}/v1/posts`,
};


const removeCompanyTagFromAllPosts = async (companySource, companyToRemoveFromPost) => {
    try {
        const allCompanyProjects = (await axios.get(RESOURCES.GET_PROJECTS_BY_COMPANY + `?companyId=${companySource}`)).data;
        let foundedPosts = [];

        for (let projectId in allCompanyProjects) {
            const posts = (await axios.get(RESOURCES.GET_POSTS_BY_PROJECT + `?projectId=${projectId}`)).data;

            let postsToAdd = _.values(posts).filter(post => {
                const taggedCompanies = post.taggedCompanies;

                if (taggedCompanies && taggedCompanies[companyToRemoveFromPost])
                    return true;
                else
                    return false;
            }).map(post => {
                return { ...post, projectId };
            });

            if (postsToAdd.length)
                foundedPosts = _.concat(foundedPosts, postsToAdd);
        }

        for (let post of foundedPosts) {
            if (post && post.id && post.taggedCompanies) {
                taggedCompanies = { ...post.taggedCompanies };
                taggedCompanies[companyToRemoveFromPost] = null;
                const data = { ...post, taggedCompanies };

                try {
                    await axios.patch(RESOURCES.PATCH_POST + `/${post.id}` + `?projectId=${post.projectId}`, data);
                } catch (error) {
                    console.log("TCL ~ file: Posts.js ~ line 44 ~ removeCompanyTagFromAllPosts ~ error", error)
                }
            }
        }

        console.log("TCL ~ file: Posts.js ~ line 31 ~ removeCompanyTagFromAllPosts ~ foundedPosts", foundedPosts);
    } catch (error) {
        console.log("TCL ~ file: Posts.js ~ line 29 ~ removeCompanyTagFromAllPosts ~ error", error)
    }
}

exports.changeTaskAssign = async (projectId, trade, assignTo) => {
    const posts = (await axios.get(RESOURCES.GET_POSTS_BY_PROJECT + `?projectId=${projectId}`)).data;

    let isTradeExist = _.get(Trades, [trade]);
    let dbUpdates = {};


    if (isTradeExist && assignTo) {
        let postsByTrade = _.values(posts).filter(post => _.get(post, ["trade", "id"]) === trade);

        for (let post of postsByTrade) {
            if (post && post.id && post.assignTo.id !== assignTo)
                _.set(dbUpdates, `posts/${projectId}/${post.id}/assignTo/id`, assignTo);
        }

        try {
            await utils.updatesOnFirebaseDb(dbUpdates);
        } catch (error) {
            console.log('error', error);
        }
    }
}

exports.fixEzraBug = async (projectId1, projectId2) => {
    try {
        await removeCompanyTagFromAllPosts(projectId1, projectId2);
        await removeCompanyTagFromAllPosts(projectId2, projectId1);
    } catch (error) {
        console.log("TCL ~ file: Posts.js ~ line 15 ~ exports.fixEzraBug= ~ error", error)
    }
}