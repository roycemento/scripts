const _ = require('lodash');
const utils = require('./Utils');

// Collect all the duplicate checklist of the required checklistId.
// Find all the items with checklistId of the duplicate checklist and remove it from the item.


// Ask hagar what she meant.

exports.RemoveDuplicateChecklistsFromItems = async (projectId, checklistId) => {
    let dbUpdates = {};

    try {
        let checklistItems = await utils.getCollection(`checklists/${projectId}/items`);

        for (let itemId in checklistItems) {
            if (_.get(checklistItems, [itemId, "checklistIds", checklistId]))
                _.set(dbUpdates, [`checklists/${projectId}/items/${itemId}/checklistIds/${checklistId}`], null);
        }

        await utils.firebaseUpdate(dbUpdates);

    } catch (error) {
        console.log('error', error);
    }
}

