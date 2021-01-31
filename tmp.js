const BaseFirebaseController = require('../BaseFirebaseController');
const moment = require('moment-timezone');
const utils = require('../../Utils/utils');
const _ = require('lodash');

const carouselsConst = "Bearer hadarchangingtokenseyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjU2Mjc1ODMsImlzcyI6Imh0dHBzOi8vY2VtZW50by5haSIsImlhdCI6MTU4NjE5MTg0N30.N5TMpjyVXLzLXa3YuSd-9DAEqf9qPCIjpD7uDTdtNqQ";
function checkAuthorization(req, res, next) {
	let authorization = req.header('Authorization');
	return (authorization == carouselsConst);
};

exports.getEvents = async function (req, res, next) {
	const { projectId, startTS, endTS, type, employeeId } = utils.extractParams(req);
	if (!projectId) {
		utils.send(req, res, next, null, utils.status.badRequest)
		return;
	}
	let allEvents = await BaseFirebaseController.getList(`/siteControl/${projectId}/entrance`, req);
	if (startTS) {
		let ts = new Date(startTS).getTime();
		allEvents = { ...allEvents };
		allEvents.loopEach((k, v) => { if (v.ts < ts) delete allEvents[k] });
	}
	if (endTS) {
		let ts = new Date(endTS).getTime();
		allEvents = { ...allEvents };
		allEvents.loopEach((k, v) => { if (v.ts > ts) delete allEvents[k] });
	}
	if (employeeId) allEvents = utils.filterIfFieldContainsValue(allEvents, employeeId, ['employeeId']);
	if (type) allEvents = utils.filterIfFieldContainsValue(allEvents, type, ['type']);

	utils.send(req, res, next, allEvents);
	return allEvents;
}

exports.createEvents = async function (req, res, next) {
	const { projectId } = utils.extractParams(req);
	if (!checkAuthorization(req, res, next)) { utils.send(req, res, next, null, utils.status.unauthorized); return; }
	if (!projectId) { utils.send(req, res, next, null, utils.status.badRequest); return; }
	let path = `/siteControl/${projectId}/entrance`;

	let exists = {};
	let events = await utils.axios(req, { url: `${utils.envVariables.apiServer}/v1/siteControl/entrance/events?projectId=${projectId}&startTS=${startTS}&endTS=${endTS}`, method: 'GET' });
	events.loopEach(e => {
		if (!exists[e.employeeId]) exists[e.employeeId] = {};
		exists[e.employeeId][e.eventTS] = e;
	})

	let types = { 'enter': true, 'reject': true, 'leave': true, 'no-match': true };
	let eventsToSave = [];
	(req.body || []).forEach(e => {
		if (!types[e.type]) return
		let eventTS = new Date(e.eventDate).getTime();
		if (exists[e.employeeId][e.eventTS]) return;
		eventsToSave.push({
			id: utils.firebaseId(path),
			employeeId: e.employeeId,
			eventTS,
			type: e.type,
			images: e.imageUrl ? { uri: e.imageUrl } : null,
		})
	});
	await BaseFirebaseController.create(
		path,
		{ employeeId: 'string', eventTS: 'number', type: 'string', images: 'object' },
		null,
		{ body: eventsToSave },
		res,
		next);
}

exports.getEmployees = async function (req, res, next) {
	const { projectId, id, validEmployeesOnly, includeDeleted } = utils.extractParams(req);

	if (!projectId)
		return utils.send(req, res, next, null, utils.status.badRequest);

	let idPath = id ? '/' + id : "";
	let propertiesTypesPromise = utils.axios(req, { url: `${utils.envVariables.apiServer}/v1/properties?projectId=${projectId}&subjectName=employeesInfo`, method: 'GET' });
	let employeesPromise = utils.axios(req, { url: `${utils.envVariables.apiServer}/v1/employees` + idPath + `?projectId=${projectId}`, method: 'GET' });
	let propertiesInstancesPromise = utils.axios(req, { url: `${utils.envVariables.apiServer}/v1/propertiesInstances?subjectName=employeesInfo&projectId=${projectId}`, method: 'GET' }); //TODO: Send the parentId if given as a filter
	let projectTZPromise = utils.getMetadata(projectId, 'projectTzLocation');

	try {
		let [props, employees, propInstances, projectTZ] = await Promise.all([propertiesTypesPromise, employeesPromise, propertiesInstancesPromise, projectTZPromise]);


		let todayLocalTime = new Date(moment.tz(projectTZ).format('YYYY-MM-DD')).getTime();
		let aYearFromToday = todayLocalTime + (3600000 * 24 * 365);

		if (id)
			employees = { [employees.id]: employees }

		props = await props;
		props = props.properties || {};

		let permittedEmployees = {}
		let requiredMissing = {};

		props.loopEach((id, prop) => { if (prop.settings && prop.settings.isRequired) requiredMissing[prop.id] = true });

		_.toPairs(employees).forEach(([id, emp]) => {
			if (includeDeleted || !emp.isDeleted)
				permittedEmployees[id] = { requiredMissing: { ...requiredMissing } };
			if (includeDeleted && emp.isDeleted)
				permittedEmployees[id].isDeleted = true;
		});

		_.toPairs(propInstances).forEach(([id, inst]) => {
			if (!employees[inst.parentId])
				return;

			if (!permittedEmployees[inst.parentId])
				return;

			let currProp = props[inst.propId]

			if (!currProp)
				return;

			let empPermObj = permittedEmployees[inst.parentId];
			let certificateTTL = null;
			empPermObj.isActive = true; // By default the employee is active

			if (currProp.universalId == 'isActive') {
				empPermObj.isActive = Boolean(inst.data);

				if (validEmployeesOnly && !empPermObj.isActive) {
					delete permittedEmployees[inst.parentId];
					return;
				}

			} else if (currProp.universalId == 'avatar') {
				if (inst.data && Array.isArray(inst.data))
					empPermObj.images = inst.data.map(i => ({ uri: i.uri }));
				else if (inst.data && inst.data.uri)
					empPermObj.images = { uri: inst.data.uri };
			}
			else if (currProp.universalId == 'fullName') {
				empPermObj.fullName = inst.data;
			}
			else if (currProp.universalId == 'employeeCompany') {
				if (inst.propType === 'String')
					empPermObj.company = inst.data;
				else if (!empPermObj.company && inst.propType === 'SelectionList') {
					let cmpId = inst.data && Object.keys(inst.data)[0];
					let company = cmpId && currProp.values.filter(o => o.id == cmpId)[0];
					company = company && Object.values(company.title)[0];
					empPermObj.company = company;
				}

			}

			if (currProp.type == 'Certification' && inst.data)
				certificateTTL = inst.data[inst.data.length - 1].certificationTTL;
			else if (currProp.type == 'Date' && currProp.settings && currProp.settings.isExpiration)
				certificateTTL = inst.data;

			if (currProp.settings && currProp.settings.isRequired)
				delete empPermObj.requiredMissing[currProp.id];

			if (certificateTTL) {
				empPermObj.permitTTL = Math.min(certificateTTL, empPermObj.permitTTL || certificateTTL);

				if (validEmployeesOnly && (certificateTTL <= todayLocalTime))
					delete permittedEmployees[inst.parentId]
			}
		});


		let mapToRet = {};

		_.toPairs(permittedEmployees).forEach(([id, emp]) => {
			if (Object.values(emp.requiredMissing).length == 0) {
				mapToRet[id] = {
					id,
					isActive: emp.isActive,
					permitExpirationDate: new Date(emp.permitTTL || aYearFromToday).toISOString(),
					images: emp.images,
					fullName: emp.fullName,
					company: emp.company
				}
				if (includeDeleted && emp.isDeleted)
					mapToRet[id].isDeleted = emp.isDeleted;
			}
		})

		return utils.send(req, res, next, mapToRet);
	} catch (error) {
		return utils.send(req, res, next, { error }, utils.status.serverError);
	}
}

exports.routes = [
	{ method: 'get', path: '/v1/siteControl/entrance/events', controller: exports.getEvents, safeToProductionMonitoring: false },
	{ method: 'get', path: '/v1/siteControl/entrance/employees', controller: exports.getEmployees, safeToProductionMonitoring: false },
	{ method: 'post', path: '/v1/siteControl/entrance/events', controller: exports.createEvents, safeToProductionMonitoring: false }
];

