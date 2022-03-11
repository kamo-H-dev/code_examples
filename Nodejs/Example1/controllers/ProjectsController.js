const fs = require('fs');
const projectService = require('../services/projectService');
const projectSummaryService = require('../services/projectSummaryService');
const userService = require('../services/userService');
const hiringRequestService = require('../services/hiringRequestService');
const buildingElementService = require('../services/buildingElementService');
const productResultService = require('../services/productResultService');
const planner5dApi = require('../services/planner5dApi');
const projectCostService = require('../services/projectCostService');
const {
  Log,
  consoleLog,
  appCatchErrors,
  getClientIp,
  percentCalculator,
  roundAndFix,
  makeDecimal,
} = require('../services/utilsService');
const { AppSendError } = require('../services/Errors');
const {
  projectValidator,
  defaultBuildingElementValidator,
  dynamicValidator,
  updateProjectValidator,
  updateProjectElementsValidator,
} = require('../validators');
const {
  MESSAGE_TYPES,
  REQUEST_STATUS,
  IMAGES_UPLOAD_PATH,
  RESOURCE_TYPES,
  ROLE_TYPES,
  PROJECT_STATUS,
  BUILDING_TYPES,
  PROJECT_TYPE,
} = require('../constants');
const { substitutionValues } = require('../language/heplerFunctions');
const {sendMessageToDevMail} = require('../services/devEmailService');
const {
  projectNotFound,
  restrictedMakeChanges,
  mustProvideFloor,
  mustProvideParking,
  alreadyHaveProject,
  projectNotExists,
  noLocationSet,
  projectNameNotUpdated,
  projectDeleteInProgress,
  projectNotDeleted,
  restrictedMakeChangesSorry,
  sorrySomethingWrong,
  projectWithElementNotFound,
  projectSummaryNotFound,
  restrictedMakeStatusCompleted,
  haveNotPermissionAction,
  restrictedMakeManual,
  projectAlreadyManual,
} = require(`../language/${projectLang}/`).controllers;
const planner5dData = require('../planner5dData');

/**
 * Update project building elements from planner5d api
 *
 * @param body
 * @param headers
 * @param connection
 * @param user
 * @param res
 * @return {Promise<*>}
 */
const updateFromPlanner5d = async ({body, headers, connection, user}, res) => {
  const ipAddress = getClientIp(headers, connection);
  consoleLog('ProjectsController -> updateFromPlanner5d ');
  try {
    const {error} = dynamicValidator.setFields({
      projectId: dynamicValidator.objectId,
      userId: dynamicValidator.objectIdOptional,
    })
      .validate(body);
    if (error) throw error;

    let projectCreator = JSON.parse(JSON.stringify(user));

    if (body.userId && body.userId.toString() !== user._id.toString()) {
      projectCreator = await userService.getUserByQuery({_id: body.userId}).lean();
    }

    const project = await projectService.getProjectByQuery({userId: projectCreator._id, _id: body.projectId});
    if (!project) throw new AppSendError(projectNotFound);

    if (project.isManual) throw new AppSendError(projectNotFound);

    if([PROJECT_STATUS.ACCEPTED, PROJECT_STATUS.COMPLETED].indexOf(project.status) > -1) throw new AppSendError(restrictedMakeChanges);

    // archive planner5d project as well
    const plannerResponse = await planner5dApi.getProjectByKey(project.planner5dKey);
    if (plannerResponse.error || (plannerResponse.result && plannerResponse.result.error)) {
      const planner5dErrorMessage = (plannerResponse.error || plannerResponse.result.errorMessage || plannerResponse.result.error);
      const message = {
        subject:  'Planner5d error -> ProjectsController -> updateFromPlanner5d',
        text: `Get project from planner5d API: ${planner5dErrorMessage}`,
      };
      sendMessageToDevMail(message, 'ProjectsController -> updateFromPlanner5d.', user, ipAddress, Log);
      Log({
        message: 'Get project from planner5d API: ' + planner5dErrorMessage,
        actionType: MESSAGE_TYPES.PLANNER5D_ERROR,
        user,
        ipAddress
      });
    }
    const buildingElementsPlanner5d = planner5dApi.getBuildingElementsPlanner5d(plannerResponse.result.items[0].data, project.defaultBuildingElements);

    const ids = buildingElementsPlanner5d.build ? Object.keys(buildingElementsPlanner5d.build) : [];
    const demolishIds = buildingElementsPlanner5d.demolish ? Object.keys(buildingElementsPlanner5d.demolish) : [];
    const doorAndWinIds = buildingElementsPlanner5d.buildDoorsAndWindows ? Object.keys(buildingElementsPlanner5d.buildDoorsAndWindows) : [];
    const demolishDoorAndWinIds = buildingElementsPlanner5d.demolishDoorsAndWindows ? Object.keys(buildingElementsPlanner5d.demolishDoorsAndWindows) : [];
    let elements = [];
    const demolishElements = [];
    const from3DBuildingElements = project.buildingElements.filter(el => el.from3D);
    if (from3DBuildingElements && from3DBuildingElements.length) {
        elements = from3DBuildingElements;
    }

    if (ids.length) {
      const buildingElements = await buildingElementService.getByIds(ids);
      for (let i = 0; i < buildingElements.length; i++) {
        const element = {
          buildingElementId: buildingElements[i]._id,
          count: buildingElementsPlanner5d.build[buildingElements[i]._id.toString()],
          productResults: buildingElements[i].productResults,
        };

        elements.push(element);
      }
    }

    const windowsIds = Object.keys(planner5dData[WINDOWS1_ID]);
    const doorIds = [...Object.keys(planner5dData[DOOR1_ID]), ...Object.keys(planner5dData[DOOR2_ID])];
    if (doorAndWinIds.length) {
      const selectedDoorIds = doorAndWinIds.filter((id) => doorIds.includes(id));
      const selectedWindowsIds = doorAndWinIds.filter((id) => windowsIds.includes(id));
      const buildingElements = await buildingElementService.getByPlanner5dId(selectedDoorIds);
      const buildingElement = await buildingElementService.getById(project.defaultBuildingElements.window);
      let count = 0;
      for (let i = 0; i < buildingElements.length; i++) {
        const element = {
          buildingElementId: buildingElements[i]._id,
          count: buildingElementsPlanner5d.buildDoorsAndWindows[buildingElements[i].planner5dId],
          productResults: buildingElements[i].productResults,
        };
        elements.push(element);
      }
      for (let i = 0; i < selectedWindowsIds.length; i++) {
        count += buildingElementsPlanner5d.buildDoorsAndWindows[selectedWindowsIds[i]];
      }
      if (selectedWindowsIds && selectedWindowsIds.length) {
        const element = {
          buildingElementId: buildingElement._id,
          count,
          productResults: buildingElement.productResults,
        };
        elements.push(element);
      }
    }

    if (demolishIds.length) {
      const buildingElements = await buildingElementService.getByIds(demolishIds);
      for (let i = 0; i < buildingElements.length; i++) {
        const element = {
          buildingElementId: buildingElements[i]._id,
          count: buildingElementsPlanner5d.demolish[buildingElements[i]._id.toString()],
          productResults: buildingElements[i].demolishedProductResults,
        };

        demolishElements.push(element);
      }
    }

    if (demolishDoorAndWinIds.length) {
      const selectedDoorIds = demolishDoorAndWinIds.filter((id) => doorIds.includes(id));
      const selectedWindowsIds = demolishDoorAndWinIds.filter((id) => windowsIds.includes(id));
      const buildingElements = await buildingElementService.getByPlanner5dId(selectedDoorIds);
      const buildingElement = await buildingElementService.getById(project.defaultBuildingElements.window);
      let count = 0;
      for (let i = 0; i < buildingElements.length; i++) {
        const element = {
          buildingElementId: buildingElements[i]._id,
          count: buildingElementsPlanner5d.demolishDoorsAndWindows[buildingElements[i].planner5dId],
          productResults: buildingElements[i].demolishedProductResults,
        };

        demolishElements.push(element);
      }
      for (let i = 0; i < selectedWindowsIds.length; i++) {
        count += buildingElementsPlanner5d.demolishDoorsAndWindows[selectedWindowsIds[i]];
      }
      if (selectedWindowsIds && selectedWindowsIds.length) {
        const element = {
          buildingElementId: buildingElement._id,
          count,
          productResults: buildingElement.productResults,
        };
        demolishElements.push(element);
      }
    }

    project.buildingElements = elements;
    project.demolishBuildingElements = demolishElements;
    await project.save();

    // START count of project cost and update
    const countAndUpdate = await projectCostService.countProjectCostAndUpdate(project._id.toString(), projectCreator);
    if (!countAndUpdate.success && countAndUpdate.error) {
      Log({
        message: 'ProjectsController -> updateFromPlanner5d: count project cost occurred error - ' + countAndUpdate.error,
        actionType: MESSAGE_TYPES.ERROR,
        user,
        ipAddress
      });
    }
    // END count of project cost and update

    if (res) return res.status(200).send({success: true});

    return { success: true };

  }catch (e) {
    if (res) {
      appCatchErrors(e,
        'ProjectsController -> updateFromPlanner5d',
        '',
        ipAddress,
        res,
        user
      );
    } else {
      Log({
        message: 'ProjectsController -> updateFromPlanner5dr called from inner submit project action - ' + e.message,
        actionType: MESSAGE_TYPES.ERROR,
        user,
        ipAddress
      });
      return { success: false };
    }
  }
};

module.exports = {

  /**
   * Create a project
   *
   * @param body {object}
   * @param user {object}
   * @param res
   * @param connection
   * @param headers
   * @return {Promise<*>}
   */
    createProject: async ({body, user, connection, headers}, res) => {
      const ipAddress = getClientIp(headers, connection);
      consoleLog('ProjectsController -> createProject');
      const userId = user._id;
      try{
        const {error, value} = projectValidator.validate(body);
        if (error) throw error;

        const {buildingType, elevator, parkingProvided, parkingRate} = body;
        if (buildingType && buildingType === BUILDING_TYPES.APARTMENT) {
          if (!body.floors) throw new AppSendError(mustProvideFloor);
        }
        if (body.floors < 3 && elevator) {
          value.elevator = false;
        }
        if (!parkingProvided && !parkingRate) throw new AppSendError(mustProvideParking);

        if (parkingProvided && parkingRate) {
          value.parkingRate = 0;
        }

        if (value.isAddressMatches && !user.address) {
          userService.updateUser({_id: user._id}, { address: value.address }).then((result) => {
            Log({ message: 'User address is successfully synchronized with project , address - ' + value.address, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
          }).catch((err) => {
            Log({ message: 'User address is not updated while creating project with address', actionType: MESSAGE_TYPES.CATCH_ERROR, user, ipAddress});
            consoleLog('ERROR', err);
          });
        } else if (value.isAddressMatches && user.address) {
          value.address = user.address;
        }
        const newProject = await new Promise(async (resolve, reject) => {
          try {
            const project = await projectService.getProjectByQuery({name: body.name, userId, deleted: false, status: {$ne: PROJECT_STATUS.WAITING}});
            if (project) return reject(new AppSendError(substitutionValues(alreadyHaveProject, {name: body.name})));

            const newProject = await projectService.createProject({...value, userId});
            if (user.planner5dData && !value.isManual) {
              const plannerResponse = await planner5dApi.createProject(user.planner5dData.token, newProject.name, newProject.projectType);
              if (plannerResponse && plannerResponse.result && plannerResponse.result.key) {
                newProject.planner5dKey = plannerResponse.result.key;
                await newProject.save();
              } else if (plannerResponse.error || (plannerResponse.result && plannerResponse.result.error)) {
                const planner5dErrorMessage = plannerResponse.error || plannerResponse.result.errorMessage;
                const message = {
                  subject:  'Planner5d error -> ProjectsController -> createProject',
                  text: `${planner5dErrorMessage}`,
                };
                sendMessageToDevMail(message , ' ProjectsController -> createProject.', user, ipAddress, Log);
                Log({
                  message: planner5dErrorMessage,
                  actionType: MESSAGE_TYPES.PLANNER5D_ERROR,
                  user,
                  ipAddress
                });
              }
            }
            resolve(newProject);
          }catch (e) {
            reject(e);
          }
        });

        await projectSummaryService.createBlankSummary(newProject._id);
        Log({ message: 'Project has been created successfully! projectId - ' + newProject._id, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
        return res.status(200).send(newProject);
      }catch (e) {
        appCatchErrors(e,
          'ProjectsController -> createProject' ,
          '',
          ipAddress,
          res,
          user
        );
      }
  },

  /**
   * Get project by id
   *
   * @param params
   * @param user
   * @param res
   * @param connection
   * @param headers
   * @return {Promise<*>}
   */
  getProjectById: async ({params, user, connection, headers}, res) => {
    consoleLog('ProjectsController -> getProjectById -> id - ' + params.id);
    const ipAddress = getClientIp(headers, connection);
    try{
      const { error } = dynamicValidator.setFields({
        id: dynamicValidator.objectId,
      }).validate({id: params.id});
      if (error) throw error;

      let project = await projectService.getProjectWithBuildingElement({$and: [{_id: params.id}, {$or: [ { userId: user._id }, { organizationId: user._id } ] } ]});
      project = JSON.parse(JSON.stringify(project));
      if (!project) throw new AppSendError(projectNotExists);
      if ([PROJECT_STATUS.ACCEPTED, PROJECT_STATUS.COMPLETED].indexOf(project.status) > -1) {
        if (project.archivedData) {
          project.buildingElements = JSON.parse(project.archivedData);
        }
        if (project.demolishArchivedData) {
          project.demolishBuildingElements = JSON.parse(project.demolishArchivedData);
        }
      }

      if (project.status === PROJECT_STATUS.PENDING && project.organizationId._id.toString() === user._id.toString()) {
        const projectOwner = await userService.getUserPlannerToken(project.userId);
        project.plannerEditToken = projectOwner.planner5dData.token;
      }
      if (project.projectType === PROJECT_TYPE.RENOVATION && !project.isManual) {
        // archive planner5d project as well
        const plannerResponse = await planner5dApi.getProjectByKey(project.planner5dKey);
        if (plannerResponse.result.items[0].data.projectType === PROJECT_TYPE.RENOVATION && plannerResponse.result.items[0].data.items[0].oldState) {
          project.isInSecondStep = true;
        }
      }

      Log({ message: 'Project has been successfully fetched , projectId - ' + project._id, actionType: MESSAGE_TYPES.SUCCESS, user: user, ipAddress });
      let others = [];
      if (project.buildingElements) {
        for (let buildingElem of project.buildingElements) {
          if (buildingElem.buildingElementId.code === 27 && buildingElem.buildingElementId.otherBEId) {
            !others.includes(buildingElem.buildingElementId.otherBEId) && others.push(buildingElem.buildingElementId.otherBEId);
          }
        }
      }
      if (project.demolishBuildingElements) {
        for (let buildingElem of project.demolishBuildingElements) {
          if (buildingElem.buildingElementId.code === 27 && buildingElem.buildingElementId.otherBEId) {
            !others.includes(buildingElem.buildingElementId.otherBEId) && others.push(buildingElem.buildingElementId.otherBEId);
          }
        }
      }
      if (others.length) {
        const othersBEInFoundation = await buildingElementService.findByIdsArray(others);
        if (project.buildingElements && project.buildingElements.length) {
          for (let item = 0; item < project.buildingElements.length; item++) {
            if (project.buildingElements[item].buildingElementId.code === 27 && project.buildingElements[item].buildingElementId.otherBEId) {
              //can't add together two virtual fields
              project.buildingElements[item].buildingElementId.otherBEId = othersBEInFoundation.find((itemInner) => itemInner.id === project.buildingElements[item].buildingElementId.otherBEId.toString());
            }
          }
        }
        if (project.demolishBuildingElements && project.demolishBuildingElements.length) {
          for (let item = 0; item < project.demolishBuildingElements.length; item++) {
            if (project.demolishBuildingElements[item].buildingElementId.code === 27 && project.demolishBuildingElements[item].buildingElementId.otherBEId) {
              //can't add together two virtual fields
              project.demolishBuildingElements[item].buildingElementId.otherBEId = othersBEInFoundation.find((itemInner) => itemInner.id === project.demolishBuildingElements[item].buildingElementId.otherBEId.toString());
            }
          }
        }

      }

      return res.status(200).send(project);
    }catch (e) {
      appCatchErrors(e,
        'ProjectsController -> getProjectById' ,
        '',
        ipAddress,
        res,
        user
      );
    }
  },

  /**
   * Get projects for logged user
   *
   * @param user
   * @param res
   * @param connection
   * @param headers
   * @return {Promise<*>}
   */
  getProjectsByUser: async ({user, connection, headers}, res) => {
    consoleLog('ProjectsController -> getProjectsByUser');
    const ipAddress = getClientIp(headers, connection);
    const {_id, roleType} = user;
    try{
      const projectIds = [];
      const query = {};
      if (roleType === ROLE_TYPES.CUSTOMER) {
        query['$and'] = [{userId: _id}, {deleted: false}];
      } else {
        query['$and'] = [
          {
            $or: [{userId: _id, deleted: false}, {
              organizationId: _id,
              deleted: false,
              status: {$ne: PROJECT_STATUS.PENDING}
            }]
          }];
      }
      const projects = await projectService.getProjects(query);
      projects.map((pr) => {
        if (!pr.isManual && pr.organizationId && pr.organizationId.toString() === _id.toString()) {
          pr.planner5dImg = `${process.env.PLANNER5D_BASE_URL}/storage/thumbs.300/${pr.planner5dKey}.jpg`;
        }
        projectIds.push(pr._id);
      });

      const {result, error} = await planner5dApi.getProjects(user.planner5dData.token);

      // START projects migrations with planner5d
      const promises = [];
      if (result && result.projects) {
        result.projects.forEach((plannerPr) => {
          const project = projects.find((myPr) => myPr.planner5dKey === plannerPr.key);
          if (project) {
            if (project.status === PROJECT_STATUS.WAITING) {
              const projectIndex = projects.findIndex((myPr) => myPr.planner5dKey === plannerPr.key);
              projects.splice(projectIndex, 1);
            } else {
              let date = new Date(project.createdAt);
              date.setSeconds(date.getSeconds() + 5);
              project.planner5dImg = (new Date(plannerPr.date) > date && plannerPr.images && plannerPr.images['300']) || '';
            }
          } else {
            // Start create new project if it does not exist in our site but exists in planner5d
            const newProjectData = {
              planner5dKey: plannerPr.key,
              name: plannerPr.name,
              description: plannerPr.name,
              address: user.address || noLocationSet,
              userId: user._id,
              createdAt: new Date(plannerPr.date),
            };
            const promise = new Promise((resolve) => {
              projectService.createProject(newProjectData).then((newProject) => {
                const project = JSON.parse(JSON.stringify(newProject));
                project.userId = {_id: project.userId, name: user.name};
                projects.push({...project, planner5dImg: plannerPr.images && plannerPr.images['300'] || ''});
                resolve(project);
              }).catch((err) => { // no need to reject for not break the process in `try catch`
                Log({ message: 'Error create project: ' + err, actionType: MESSAGE_TYPES.ERROR, user, ipAddress });
                resolve({});
              });
            });
            promises.push(promise);
          }
          // END create new project
        });
      } else if (error || result.error) {
        const planner5dErrorMessage = (error || result.errorMessage || result.error);
        const message = {
          subject:  'Planner5d error -> ProjectsController -> getProjectsByUser',
          text: `'Error from get projects planer5d API: ${planner5dErrorMessage}`,
        };
        sendMessageToDevMail(message , 'ProjectsController -> getProjectsByUser.', user, ipAddress, Log);
        Log({ message: 'Error from get projects planer5d API: ' + planner5dErrorMessage, actionType: MESSAGE_TYPES.PLANNER5D_ERROR, user, ipAddress });
      }
      if (promises.length) { // await if there any new projects created
        await Promise.all(promises);
      }
      // END projects migrations with planner5d

      Log({ message: 'Projects has been successfully fetched', actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress });
      return res.status(200).send(projects);
    }catch (e) {
      appCatchErrors(e,
        'ProjectsController -> getProjectsByUser' ,
        sorrySomethingWrong,
        ipAddress,
        res,
        user
      );
    }
  },

  /**
   * Submit project and get organizations
   *
   * @param params
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @returns {Promise<*>}
   */
  submitProject: async ({params, headers, connection, user}, res) => {
    consoleLog('ProjectsController -> submitProject -> id: ' + params.projectId);
    const ipAddress = getClientIp(headers, connection);
    try{
      const organizations = await userService.getActiveOrganizations();
      const projectIsManual = await projectService.getProjectIsManual(params.projectId);

      if (projectIsManual && !projectIsManual.isManual) { // update BE data from planner5d API
        const updatePlannerResponse = await updateFromPlanner5d({
          body: {projectId: params.projectId, userId: params.userId},
          headers,
          connection,
          user
        });
      }

      const project = await projectService.getProjectWithBuildingElement({_id: params.projectId, userId: user._id, deleted: false});
      if (!project) throw new AppSendError(projectNotExists);
      let withComposite = false;
      let responseData = [];
      let materialCost = 0;
      const organizationCostsById = {};

      const organizationWithSpec = [];
      organizations.forEach((org) => {

        if ((org.organizationData.specifications && org.organizationData.specifications.length)
          || (org.roleType === ROLE_TYPES.FABRICATOR && org.organizationData.composites && org.organizationData.composites.length)) {
          organizationCostsById[org._id] = {workforceCost: 0, compositeCost: 0};
          organizationWithSpec.push({});
          const index = organizationWithSpec.length - 1;

          if (org.organizationData.specifications && org.organizationData.specifications.length) {
            org.organizationData.specifications.forEach((sp) => {
              organizationWithSpec[index][sp.specificationId] = {pricePerHour: sp.price_per_hour, orgId: org._id};
            });
          }

          if (org.roleType === ROLE_TYPES.FABRICATOR && org.organizationData.composites && org.organizationData.composites.length) {
            org.organizationData.composites.forEach((sp) => {
              organizationWithSpec[index][sp.compositeId] = {square_meter_price: sp.square_meter_price, orgId: org._id};
            });
          }
        }

      });

      if (project.buildingElements) {
        project.buildingElements.forEach((be) => {

          if (!be.productResults) return;

          be.productResults.forEach((pr) => {
            if (!pr.productResultId) return;

            pr.productResultId.resources.forEach((re) => {
              if (re.resourceId && re.resourceId._id) {
                if (re.resourceId.type === RESOURCE_TYPES.WORKFORCE) {
                  const workforceId = re.resourceId._id.toString();
                  organizationWithSpec.forEach((org) => {
                    if (org[workforceId]) {
                      const {orgId, pricePerHour} = org[workforceId];
                      organizationCostsById[orgId].workforceCost += pricePerHour * (re.count * pr.count * be.count);
                    } else {
                      const {orgId} = Object.values(org)[0];
                      if (organizationCostsById[orgId] && organizationCostsById[orgId].notIncludedWorkforces) {
                        if (!organizationCostsById[orgId].notIncludedWorkforces.find((i) => i._id === workforceId)) {
                          organizationCostsById[orgId].notIncludedWorkforces.push({name: re.resourceId.name, _id: workforceId});
                        }
                      } else if (organizationCostsById[orgId]){
                        organizationCostsById[orgId].notIncludedWorkforces = [{name: re.resourceId.name, _id: workforceId}];
                      } else {
                        organizationCostsById[orgId] = { notIncludedWorkforces: [{name: re.resourceId.name, _id: workforceId}] };
                      }
                    }
                  });
                } else if (re.resourceId.type === RESOURCE_TYPES.COMPOSITE) {
                  withComposite = true;
                  const compositeId = re.resourceId._id.toString();
                  organizationWithSpec.forEach((org) => {
                    if (org[compositeId]) {
                      const {orgId, square_meter_price} = org[compositeId];
                      materialCost += square_meter_price * (re.count * pr.count * be.count);
                      organizationCostsById[orgId].compositeCost += square_meter_price * (re.count * pr.count * be.count);
                    } else {
                      const {orgId} = Object.values(org)[0];
                      if (organizationCostsById[orgId] && organizationCostsById[orgId].notIncludedComposites) {
                        if (!organizationCostsById[orgId].notIncludedComposites.find((i) => i._id === compositeId)) {
                          organizationCostsById[orgId].notIncludedComposites.push({name: re.resourceId.name, _id: compositeId});
                        }
                      } else if (organizationCostsById[orgId]){
                        organizationCostsById[orgId].notIncludedComposites = [{name: re.resourceId.name, _id: compositeId}];
                      } else {
                        organizationCostsById[orgId] = { notIncludedComposites: [{name: re.resourceId.name, _id: compositeId}] };
                      }
                    }
                  });
                } else {
                  materialCost += (re.count * pr.count * be.count * re.resourceId.price);
                }
              }
            });
          });
        });
      }

      if (project.demolishBuildingElements) {
        project.demolishBuildingElements.forEach((be) => {

          if (!be.productResults) return;

          be.productResults.forEach((pr) => {
            if (!pr.productResultId) return;

            pr.productResultId.resources.forEach((re) => {
              if (re.resourceId && re.resourceId._id) {
                if (re.resourceId.type === RESOURCE_TYPES.WORKFORCE) {
                  const workforceId = re.resourceId._id.toString();
                  organizationWithSpec.forEach((org) => {
                    if (org[workforceId]) {
                      const {orgId, pricePerHour} = org[workforceId];
                      organizationCostsById[orgId].workforceCost += pricePerHour * (re.count * pr.count * be.count);
                    } else {
                      const {orgId} = Object.values(org)[0];
                      if (organizationCostsById[orgId] && organizationCostsById[orgId].notIncludedWorkforces) {
                        if (!organizationCostsById[orgId].notIncludedWorkforces.find((i) => i._id === workforceId)) {
                          organizationCostsById[orgId].notIncludedWorkforces.push({name: re.resourceId.name, _id: workforceId});
                        }
                      } else if (organizationCostsById[orgId]){
                        organizationCostsById[orgId].notIncludedWorkforces = [{name: re.resourceId.name, _id: workforceId}];
                      } else {
                        organizationCostsById[orgId] = { notIncludedWorkforces: [{name: re.resourceId.name, _id: workforceId}] };
                      }
                    }
                  });
                } else if (re.resourceId.type === RESOURCE_TYPES.COMPOSITE) {
                  withComposite = true;
                  const compositeId = re.resourceId._id.toString();
                  organizationWithSpec.forEach((org) => {
                    if (org[compositeId]) {
                      const {orgId, square_meter_price} = org[compositeId];
                      materialCost += square_meter_price * (re.count * pr.count * be.count);
                      organizationCostsById[orgId].compositeCost += square_meter_price * (re.count * pr.count * be.count);
                    } else {
                      const {orgId} = Object.values(org)[0];
                      if (organizationCostsById[orgId] && organizationCostsById[orgId].notIncludedComposites) {
                        if (!organizationCostsById[orgId].notIncludedComposites.find((i) => i._id === compositeId)) {
                          organizationCostsById[orgId].notIncludedComposites.push({name: re.resourceId.name, _id: compositeId});
                        }
                      } else if (organizationCostsById[orgId]){
                        organizationCostsById[orgId].notIncludedComposites = [{name: re.resourceId.name, _id: compositeId}];
                      } else {
                        organizationCostsById[orgId] = { notIncludedComposites: [{name: re.resourceId.name, _id: compositeId}] };
                      }
                    }
                  });
                } else {
                  materialCost += (re.count * pr.count * be.count * re.resourceId.price);
                }
              }
            });
          });
        });
      }

      const checkRoleTypes = withComposite ? [ROLE_TYPES.FABRICATOR] : [ROLE_TYPES.FABRICATOR, ROLE_TYPES.CONTRACTOR];
      responseData = organizations.filter((og) => {
        return checkRoleTypes.indexOf(og.roleType) > -1  && (organizationCostsById[og._id] && (organizationCostsById[og._id].workforceCost || organizationCostsById[og._id].compositeCost));
      }).map((item) => {
        const cost = roundAndFix(organizationCostsById[item._id].workforceCost + materialCost + organizationCostsById[item._id].compositeCost);
        const finalCost =  cost + percentCalculator(cost, 25);
        const response = {
          _id: item._id,
          photo: item.photo,
          name: item.organizationData.organizationName,
          roleType: item.roleType,
          cost: makeDecimal(finalCost),
          notIncludedWorkforces: organizationCostsById[item._id] && organizationCostsById[item._id].notIncludedWorkforces || [],
        };
        if(item.roleType === ROLE_TYPES.FABRICATOR) {
          response.notIncludedComposites = organizationCostsById[item._id] && organizationCostsById[item._id].notIncludedComposites || [];
        }
        return response;
      });


      Log({ message: 'Organizations are fetched successfully', actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress });
      return res.status(200).send(responseData);
    }catch (e) {
      appCatchErrors(e,
        'ProjectsController -> submitProject' ,
        sorrySomethingWrong,
        ipAddress,
        res,
        user
      );
    }
  },

  /**
   * rename project by projectId and userId
   *
   * @param body
   * @param user
   * @param headers
   * @param connection
   * @param res
   * @returns {Promise<*>}
   */
  renameProject: async ({body, user, headers, connection}, res) => {
    const {projectId, newName} = body;
    consoleLog('ProjectsController -> renameProject -> projectId: ' + projectId);
    const ipAddress = getClientIp(headers, connection);
    try{
      const {error} = dynamicValidator.setFields({
        projectId: dynamicValidator.objectId,
        newName: dynamicValidator.string
      }).validate({projectId, newName});
      if (error) throw error;

      const updatedProject = await new Promise(async (resolve, reject) => {
        const project = await projectService.getProjectByQuery({name: newName, userId: user._id, deleted: false});
        if (project) return reject(new AppSendError(substitutionValues(alreadyHaveProject, {name: newName})));

        const updatedProject = await projectService.updateProject({
          filter: {_id: projectId, userId: user._id, deleted: false},
          updater: {name: newName}
        });
        if(!updatedProject) throw new AppSendError(projectNameNotUpdated);

        if (!updatedProject.isManual) {
          // update planner5d project as well
          const {result, error} = await planner5dApi.updateProject(user.planner5dData.token, updatedProject.planner5dKey, newName);
          if (error || (result && result.error)) {
            const planner5dErrorMessage =  (error || result.errorMessage || result.error);
            const message = {
              subject:  'Planner5d error -> ProjectsController -> submitProject',
              text: `Error update project from planner5d API: ${planner5dErrorMessage}`,
            };
            sendMessageToDevMail(message, 'ProjectsController -> submitProject', user, ipAddress , Log);
            Log({
              message: 'Error update project from planner5d API: ' + planner5dErrorMessage,
              actionType: MESSAGE_TYPES.PLANNER5D_ERROR,
              user,
              ipAddress
            });
          }
        }

        resolve(updatedProject);
      });

      Log({ message: 'Project name has been updated successfully. New name - ' + newName, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress });
      return res.status(200).send({success: updatedProject});
    }catch (e) {
      appCatchErrors(e,
        'ProjectsController -> submitProject' ,
        '',
        ipAddress,
        res,
        user
      );
    }
  },

  /**
   * Archive project with projectId
   *
   * @param params
   * @param user
   * @param headers
   * @param connection
   * @param res
   * @returns {Promise<*>}
   */
  deleteProject: async ({params, user, headers, connection}, res) => {
    const {projectId} = params;
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> renameProject -> projectId: ' + projectId);
    try{
      const {error} = dynamicValidator.setFields({
        projectId: dynamicValidator.objectId,
      }).validate({projectId});
      if (error) throw error;

      const activeHiringRequestsCount = await hiringRequestService.getRequestsCountByQuery({
        $and: [
          { projectId },
          { status: { $ne : REQUEST_STATUS.DECLINED } } ]
      });
      const project = await projectService.getProjectByQuery({ $and: [ { _id: projectId }, { userId: user._id } ] }).lean();
      if(activeHiringRequestsCount > 0 && project.status !== PROJECT_STATUS.COMPLETED) throw new AppSendError(substitutionValues(projectDeleteInProgress, {infoEmail: process.env.INFO_EMAIL}) );

      const updatedProject = await projectService.updateProject({
        filter: { $and: [ { _id: projectId }, { userId: user._id } ] },
        updater: {deleted: true}
      });
      if(!updatedProject || updatedProject.deleted === false){
        throw new AppSendError(projectNotDeleted);
      }

      if (!updatedProject.isManual) {
        // archive planner5d project as well
        const plannerResponse = await planner5dApi.archiveProject(user.planner5dData.token, updatedProject.planner5dKey);
        if (plannerResponse.error || (plannerResponse.result && plannerResponse.result.error)) {
          const planner5dErrorMessage =  (plannerResponse.error || plannerResponse.result.errorMessage || plannerResponse.result.error);
          const message = {
            subject:  'Planner5d error -> ProjectsController -> deleteProject',
            text: `Error archive project from planner5d API: ${planner5dErrorMessage}`,
          };
          sendMessageToDevMail(message, 'ProjectsController -> deleteProject', user, ipAddress, Log);
          Log({
            message: 'Error archive project from planner5d API: ' + planner5dErrorMessage,
            actionType: MESSAGE_TYPES.PLANNER5D_ERROR,
            user,
            ipAddress
          });
        }
      }

      Log({ message: 'Project has been successfully deleted, projectId - ' + projectId, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress });
      return res.status(200).send({success: updatedProject.deleted});
    }catch (e) {
      appCatchErrors(e,
        'ProjectsController -> deleteProject' ,
        '',
        ipAddress,
        res,
        user
      );
    }
  },

  /**
   * change picture of building elem
   *
   * @param body
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @returns {Promise<void>}
   */
  changePicture: async ({body, headers, connection, user}, res) => {
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> changePicture ');
    try {
      const currentProject = await projectService.getProjectByQuery({
        $and: [
          {_id: body._id},
          {
            $or: [
              {userId: user._id},
              {organizationId: user._id}]
          }]
      });
      if (!currentProject) throw new AppSendError(projectNotFound);

      if ((currentProject.status === PROJECT_STATUS.ACCEPTED || currentProject.status === PROJECT_STATUS.COMPLETED) && !user.actAsAdmin) {
        throw new AppSendError(restrictedMakeChangesSorry);
      }

      if (currentProject.picture) {
        const filePath = IMAGES_UPLOAD_PATH + currentProject.picture;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      currentProject.picture = body.fileName ? '/projectImages/' + body.fileName : '';
      await currentProject.save();

      Log({message:'Project picture is successfully updated, id - "' + body._id + '"', actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
      return res.status(200).send({success: currentProject.picture || true});
    } catch (e) {
      appCatchErrors(e,
        'ProjectsController -> changePicture',
        sorrySomethingWrong,
        ipAddress,
        res,
        user
      );
    }
  },


  /**
   * Update project data
   *
   * @param body
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @returns {Promise<void>}
   */
  updateProject: async ({body, headers, connection, user}, res) => {
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> updateProject ');
    try {
      let restricted = false;
      const onlyUpdateElements = body.onlyUpdateElements;
      const {buildingType, elevator, parkingProvided, parkingRate} = body;
      const materialRequestSent = body.materialRequestSent;
      delete body.onlyUpdateElements;
      delete body.materialRequestSent;
      if (onlyUpdateElements) {
        const {error} = updateProjectElementsValidator.validate(body);
        if (error) throw error;
      } else {
        if (buildingType && buildingType === BUILDING_TYPES.APARTMENT) {
          if (!body.floors) throw new AppSendError(mustProvideFloor);
        }
        if (!parkingProvided && !parkingRate) throw new AppSendError(mustProvideParking);

        const {error} = updateProjectValidator.validate(body);
        if (error) throw error;
      }

      const updatedProject = await new Promise(async (resolve, reject) => {
        try {
          const currentProject = await projectService.getProjectByQuery({
            $and: [
              {_id: body._id},
              {
                $or: [
                  {userId: user._id},
                  {organizationId: user._id}]
              }]
          }).populate({path: 'organizationId', select: {roleType: 1}});
          if (!currentProject) throw new AppSendError(projectNotFound);

          if ((currentProject.status === PROJECT_STATUS.ACCEPTED || currentProject.status === PROJECT_STATUS.COMPLETED) && !user.actAsAdmin) {
            throw new AppSendError(restrictedMakeChangesSorry);
          }

          if (!onlyUpdateElements) {
            if (currentProject.name !== body.name) {
              const projectWithName = await projectService.getProjectByQuery({
                _id: {$ne: body._id},
                name: body.name,
                userId: currentProject.userId,
                deleted: false
              });
              if (projectWithName) return reject(new AppSendError(substitutionValues(alreadyHaveProject, {name: body.name})));
            }
            currentProject.name = body.name;
            currentProject.description = body.description;
            currentProject.address = body.address;
            currentProject.floors = body.floors;
            currentProject.buildingType = body.buildingType;
            currentProject.projectType = body.projectType;
            currentProject.parkingProvided = body.parkingProvided;
            currentProject.elevator = (body.floors < 3 && elevator) ? false : elevator;
            currentProject.parkingRate = (parkingProvided && parkingRate) ? 0 : parkingRate;
          }

          if (body.buildingElements.length) {
            let buildingElements = await buildingElementService.getByIdsWithResources(body.buildingElements.map((be) => be._id));
            if (user.roleType === ROLE_TYPES.CONTRACTOR || (currentProject.organizationId && currentProject.organizationId.roleType === ROLE_TYPES.CONTRACTOR)) { // checking if project requested to contractor then do not allow add BE's with composite resource
              buildingElements = buildingElements.filter((be) => {
                if (!be.productResults) return false;

                if (currentProject.buildingElements.find(projectBe => projectBe.buildingElementId.toString() === be._id.toString())) return true;

                 const exists = be.productResults.find((pr) => {
                  return pr.productResultId && pr.productResultId.resources && pr.productResultId.resources.find((re) => re.resourceId && re.resourceId.type === RESOURCE_TYPES.COMPOSITE);
                });

                 return !exists;
              });
            }
            const currentBuildingElements = currentProject.buildingElements || [];
            const elements = [];
            const demolishElements = [];
            for (let i = 0; i < body.buildingElements.length; i++) {
              const foundElement = buildingElements.find((e) => body.buildingElements[i]._id === e._id.toString());
              const currentElement = currentBuildingElements.find((e) => body.buildingElements[i]._id === e.buildingElementId.toString());
              if (!foundElement) continue;
              if (body.projectType === PROJECT_TYPE.RENOVATION && body.buildingElements[i].demolished) {
                demolishElements.push({
                  buildingElementId: body.buildingElements[i]._id,
                  count:  body.buildingElements[i].count,
                  demolished: body.buildingElements[i].demolished,
                  from3D: body.buildingElements[i].from3D,
                  productResults: currentElement && currentElement.demolishedProductResults || foundElement.demolishedProductResults,
                });
              } else {
                elements.push({
                  buildingElementId: body.buildingElements[i]._id,
                  count:  body.buildingElements[i].count,
                  from3D: body.buildingElements[i].from3D,
                  productResults: currentElement && currentElement.productResults || foundElement.productResults,
                });
              }
            }

            currentProject.buildingElements = elements;
            currentProject.demolishBuildingElements = demolishElements;

            if ((currentProject.status === PROJECT_STATUS.ACCEPTED || currentProject.status === PROJECT_STATUS.COMPLETED)) { // this is for admin act us mode already ACCEPTED/COMPLETED projects
              if (currentProject.archivedData) {
                const buildingElements = JSON.parse(currentProject.archivedData);
                const elements = [];
                for (let i = 0; i < body.buildingElements.length; i++) {
                  const currentElement = buildingElements.find((e) => body.buildingElements[i]._id === e.buildingElementId._id);
                  if (currentElement) {
                    elements.push({...currentElement, count: body.buildingElements[i].count});
                  } else {
                    const buildingElement = await buildingElementService.findById(body.buildingElements[i]._id);
                    if (buildingElement) {
                      elements.push({
                        buildingElementId: buildingElement,
                        count: body.buildingElements[i].count,
                        productResults: buildingElement.productResults,
                      });
                    }
                  }
                }
                currentProject.archivedData = JSON.stringify(elements);
              }

              if (currentProject.demolishArchivedData) {
                const buildingElements = JSON.parse(currentProject.demolishArchivedData);
                const elements = [];
                for (let i = 0; i < body.buildingElements.length; i++) {
                  const currentElement = buildingElements.find((e) => body.buildingElements[i]._id === e.buildingElementId._id);
                  if (currentElement) {
                    elements.push({...currentElement, count: body.buildingElements[i].count});
                  } else {
                    const buildingElement = await buildingElementService.findById(body.buildingElements[i]._id);
                    if (buildingElement) {
                      elements.push({
                        buildingElementId: buildingElement,
                        count: body.buildingElements[i].count,
                        productResults: buildingElement.demolishedProductResults,
                      });
                    }
                  }
                }
                currentProject.demolishArchivedData = JSON.stringify(elements);
              }
            }
          } else if (currentProject.isManual) {
            currentProject.buildingElements = [];
            currentProject.demolishBuildingElements = [];
            if (currentProject.status === PROJECT_STATUS.ACCEPTED || currentProject.status === PROJECT_STATUS.COMPLETED) {
              currentProject.archivedData = JSON.stringify(currentProject.buildingElements);
              currentProject.demolishArchivedData = JSON.stringify(currentProject.demolishBuildingElements);
            }
          }
          if(currentProject.materialRequestSent !== materialRequestSent) currentProject.materialRequestSent = materialRequestSent;
          await currentProject.save();

          if (currentProject.status !== PROJECT_STATUS.ACCEPTED && currentProject.status !== PROJECT_STATUS.COMPLETED) {
            // START count of project cost and update
            const {success, error} = await projectCostService.countProjectCostAndUpdate(currentProject._id.toString(), user);
            if (!success && error) {
              Log({
                message: 'ProjectsController -> updateProject: count project cost occurred error - ' + error,
                actionType: MESSAGE_TYPES.ERROR,
                user,
                ipAddress
              });
            }
            // END count of project cost and update

          }
          resolve(currentProject);
        }catch (e) {
          reject(e);
        }
      });

      Log({ message: 'Project has been updated successfully! projectId - ' + updatedProject._id, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
      return res.status(200).send({ success: true , materialRequestSent});
    } catch (e) {
      appCatchErrors(e,
        'ProjectsController -> updateProject',
        '',
        ipAddress,
        res,
        user
      );
    }
  },


  /**
   * Get project with building element
   *
   * @param params
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @returns {Promise<void>}
   */
  getBuildingElement: async ({params, headers, connection, user}, res) => {
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> getBuildingElement ');
    try {
      const { projectId, elementId } = params;
      const {error, value} = dynamicValidator.setFields({
        projectId: dynamicValidator.objectId,
        elementId: dynamicValidator.objectId})
        .validate({projectId, elementId});

      if (error) throw error;
      const project = await projectService.getProjectWithBuildingElement({
          $and: [
            {_id: projectId},
            {'buildingElements.buildingElementId': elementId},
            {
              $or: [
                {userId: user._id},
                {organizationId: user._id}
                ]
            }]
        });
      if (!project) throw new AppSendError(projectWithElementNotFound);

      Log({ message: 'Project with building element has been fetched successfully! projectId - ' + project._id, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
      return res.status(200).send({project});
    } catch (e) {
      appCatchErrors(e,
        'ProjectsController -> getBuildingElement',
        '',
        ipAddress,
        res,
        user
      );
    }
  },

  /**
   * Update project building element
   *
   * @param body
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @returns {Promise<void>}
   */
  updateBuildingElement: async ({body, headers, connection, user}, res) => {
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> getBuildingElement ');
    try {
      const resetDefault = body.resetDefault;
      delete body.resetDefault;
      const {error} = dynamicValidator.setFields({
        projectId: dynamicValidator.objectId,
        elementId: dynamicValidator.objectId,
        productResults: dynamicValidator.productResults,
      })
        .validate(body);

      if (error) throw error;
      const currentProject = await projectService.getProjectByQuery({
        $and: [
          {_id: body.projectId},
          {'buildingElements.buildingElementId': body.elementId},
          {
            $or: [
              {userId: user._id},
              {organizationId: user._id}
            ]
          }]
      });
      if (!currentProject) throw new AppSendError(projectWithElementNotFound);
      const buildingElementIndex = currentProject.buildingElements.findIndex(be => be.buildingElementId.toString() === body.elementId);
      let results = [];
      if (body.productResults.length && !resetDefault) {
        const productResults = await productResultService.getByIds(body.productResults.map((p) => p.productResultId));
        for (let i = 0; i < body.productResults.length; i++) {
          const result = productResults.find((p) => body.productResults[i].productResultId === p._id.toString());
          if (!result) continue;
          const productResult = {
            productResultId: body.productResults[i].productResultId,
            count:  body.productResults[i].count,
          };

          results.push(productResult);
        }
      } else if (resetDefault) {
        const buildingElement = await buildingElementService.findByQuery({_id: body.elementId});
        if (buildingElement) {
          results = buildingElement.productResults.map((pr) => ({count: pr.count, productResultId: pr.productResultId}));
        }
      }

      currentProject.buildingElements[buildingElementIndex].productResults = results;
      await currentProject.save();

      Log({ message: 'Project building element has been updated successfully! projectId - ' + currentProject._id, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
      return res.status(200).send({success: true});
    } catch (e) {
      appCatchErrors(e,
        'ProjectsController -> getBuildingElement',
        '',
        ipAddress,
        res,
        user
      );
    }
  },


  /**
   * Get Not included workforces/composites for a project
   *
   * @param params
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @return {Promise<*>}
   */
  notIncludedResources: async ({params, headers, connection, user}, res) => {
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> notIncludedResources ');
    try {
      const notIncludedWorkforces = [];
      const notIncludedComposites = [];
      const { projectId } = params;
      const {error} = dynamicValidator.setFields({
        projectId: dynamicValidator.objectId,
        })
        .validate({projectId});

      if (error) throw error;
      const project = await projectService.getProjectWithBuildingElement({
        $and: [
          {_id: projectId},
          {
            $or: [
              {userId: user._id},
              {organizationId: user._id}
            ]
          }]
      });
      if (!project) throw new AppSendError(projectWithElementNotFound);

      const organization = await userService.getOrganizationWithSpecifications(user._id);
      const organizationWithSpec = {};
      const organizationWithComposite = {};
      if (project.status === PROJECT_STATUS.ACCEPTED || project.status === PROJECT_STATUS.COMPLETED) {
        if (project.orgSpecifications) {
          project.orgSpecifications.forEach((workforces) => {
            organizationWithSpec[workforces.specificationId.toString()] = {name: ''};
          });
        }
        if (project.orgComposites) {
          project.orgComposites.forEach((composite) => {
            organizationWithComposite[composite.compositeId.toString()] = {name: ''};
          });
        }
      } else {
        if (organization.organizationData) {
          if (organization.organizationData.specifications) {
            organization.organizationData.specifications.forEach((workforces) => {
              organizationWithSpec[workforces.specificationId.toString()] = {name: ''};
            });
          }

          if (organization.organizationData.composites) {
            organization.organizationData.composites.forEach((composite) => {
              organizationWithComposite[composite.compositeId.toString()] = {name: ''};
            });
          }
        }
      }

      if (project.buildingElements) {
        project.buildingElements.forEach((be) => {

          if (!be.productResults) return;

          be.productResults.forEach((pr) => {
            if (!pr.productResultId) return;

            pr.productResultId.resources.forEach((re) => {
              if (re.resourceId && re.resourceId._id) {
                if (re.resourceId.type === RESOURCE_TYPES.WORKFORCE) {
                  const workforceId = re.resourceId._id.toString();
                  if (!organizationWithSpec[workforceId]) {
                    if (!notIncludedWorkforces.find((i) => i._id === workforceId)) {
                      notIncludedWorkforces.push({_id: workforceId, name: re.resourceId.name});
                    }
                  }
                } else if (re.resourceId.type === RESOURCE_TYPES.COMPOSITE) {
                  const compositeId = re.resourceId._id.toString();
                  if (!organizationWithComposite[compositeId]) {
                    if (!notIncludedComposites.find((i) => i._id === compositeId)) {
                      notIncludedComposites.push({_id: compositeId, name: re.resourceId.name});
                    }
                  }
                }
              }
            });
          });
        });
      }

      Log({ message: 'Project not included workforces and composites has been fetched successfully! projectId - ' + project._id, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
      return res.status(200).send({notIncludedWorkforces, notIncludedComposites});
    } catch (e) {
      appCatchErrors(e,
        'ProjectsController -> notIncludedResources',
        '',
        ipAddress,
        res,
        user
      );
    }
  },

  /**
   * make project status completed
   *
   * @param body
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @returns {Promise<void>}
   */
  makeCompleted: async ({body, headers, connection, user}, res) => {
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> makeProjectCompleted ');
    try {
      const {error} = dynamicValidator.setFields({
        projectId: dynamicValidator.objectId,
      })
        .validate(body);
      if (error) throw error;
      let materialPrice = 0;
      const project = await projectService.getProjectWithBuildingElement({userId: user._id, _id: body.projectId});
      if (!project) throw new AppSendError(projectNotFound);
      const projectSum = await projectSummaryService.getByQuery({projectId: project._id});
      if (!projectSum) throw new AppSendError(projectSummaryNotFound);

      if((PROJECT_STATUS.ACCEPTED !== project.status || !project.organizationId)
        && user.roleType === ROLE_TYPES.CUSTOMER ) throw new AppSendError(restrictedMakeStatusCompleted);

      if([ROLE_TYPES.CONTRACTOR, ROLE_TYPES.FABRICATOR].indexOf(user.roleType) > -1){
        let BETime = 0;
        if (project.archivedData) {
          const buildingElements = JSON.parse(project.archivedData);
          buildingElements.forEach((be) => {
            if (!be.productResults) return;
            let prTime = 0;
            be.productResults.forEach((pr) => {
              if (!pr.productResultId) return;
              prTime += pr.count * pr.productResultId.time;
              pr.productResultId.resources.forEach((re) => {
                if (re.resourceId && re.resourceId._id && re.resourceId.type !== RESOURCE_TYPES.WORKFORCE) {
                  materialPrice += (re.count * pr.count * be.count * re.resourceId.price);
                }
              });
            });
            BETime += prTime * be.count;
          });
        }
        if (project.demolishArchivedData) {
          const demolishBuildingElements = JSON.parse(project.demolishArchivedData);
          demolishBuildingElements.forEach((be) => {
            if (!be.productResults) return;
            let prTime = 0;
            be.productResults.forEach((pr) => {
              if (!pr.productResultId) return;
              prTime += pr.count * pr.productResultId.time;
              pr.productResultId.resources.forEach((re) => {
                if (re.resourceId && re.resourceId._id && re.resourceId.type !== RESOURCE_TYPES.WORKFORCE) {
                  materialPrice += (re.count * pr.count * be.count * re.resourceId.price);
                }
              });
            });
            BETime += prTime * be.count;
          });
        }
        projectSum.BETime = BETime;
        projectSum.materialPrice = materialPrice;
        projectSum.save();
      }else{
        materialPrice = projectSum.materialPrice;
      }
      project.status = PROJECT_STATUS.COMPLETED;
      project.materialPrice = materialPrice;
      project.save();

      Log({ message: 'Project status changed as completed successfully! projectId - ' + project._id, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
      return res.status(200).send({ success: true });
    } catch (e) {
      appCatchErrors(e,
        'ProjectsController -> makeProjectCompleted',
        '',
        ipAddress,
        res,
        user
      );
    }
  },


  /**
   * make project as a manual
   *
   * @param body
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @returns {Promise<void>}
   */
  make3dToManual: async ({body, headers, connection, user}, res) => {
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> make3dToManual ');
    try {
      if (!user.actAsAdmin) {
        throw new AppSendError(haveNotPermissionAction);
      }
      const {error} = dynamicValidator.setFields({
        projectId: dynamicValidator.objectId,
      })
        .validate(body);
      if (error) throw error;

      const project = await projectService.getProjectByQuery({userId: user._id, _id: body.projectId});
      if (!project) throw new AppSendError(projectNotFound);

      if(PROJECT_STATUS.CREATED !== project.status) throw new AppSendError(restrictedMakeManual);
      if (project.isManual) throw new AppSendError(projectAlreadyManual);

      // archive planner5d project as well
      const plannerResponse = await planner5dApi.archiveProject(user.planner5dData.email, project.planner5dKey);
      if (plannerResponse.error || (plannerResponse.result && plannerResponse.result.error)) {
        const planner5dErrorMessage =  (plannerResponse.error || plannerResponse.result.errorMessage || plannerResponse.result.error);
        const message = {
          subject:  'Planner5d error -> ProjectsController -> make3dToManual',
          text: `Error archive project from planner5d API: ${planner5dErrorMessage}`,
        };
        sendMessageToDevMail(message, 'ProjectsController -> make3dToManual.', user, ipAddress, Log);
        Log({
          message: 'Error archive project from planner5d API: ' + planner5dErrorMessage,
          actionType: MESSAGE_TYPES.PLANNER5D_ERROR,
          user,
          ipAddress
        });
      }

      project.isManual = true;
      project.planner5dKey = '';
      project.planner5dImg = '';
      await project.save();

      Log({ message: 'Project status changed as completed successfully! projectId - ' + project._id, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
      return res.status(200).send({ success: true });
    } catch (e) {
      appCatchErrors(e,
        'ProjectsController -> make3dToManual',
        '',
        ipAddress,
        res,
        user
      );
    }
  },

  updateFromPlanner5d,

  /**
   * Get default building elements
   *
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @returns {Promise<*>}
   */

  getDefaultBuildingElements: async ({headers, connection, user}, res) => {
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> getDefaultBuildingElements');
    try {
      const result = await buildingElementService.getDefaultBEByCodes([WINDOWS1_ID, WINDOWS2_ID, WINDOWS3_ID]);
      Log({ message: 'Default building elements list is successfully fetched.', actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
      return res.status(200).send({result});
    } catch (e) {
      appCatchErrors(e,
        'ProjectsController -> getDefaultBuildingElements' ,
        sorrySomethingWrong,
        ipAddress,
        res,
        user
      );
    }
  },

  /**
   * Set default building elements
   *
   * @param params
   * @param body
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @returns {Promise<*>}
   */
  setDefaultBuildingElements: async ({params, body, headers, connection, user}, res) => {
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> setDefaultBuildingElements');
    try {
      const projectIdValidation = dynamicValidator.setFields({
        projectId: dynamicValidator.objectId,
      }).validate(params);
      if (projectIdValidation.error) throw projectIdValidation.error;

      const project = await projectService.getProjectByQuery({_id: params.projectId, userId: user._id, deleted: false});
      if (!project) throw new AppSendError(projectNotExists);

      if (project.projectType === 'new' && project.floors < 1) {
        const {error} = defaultBuildingElementValidator.defaultBEWithoutSlab.validate(body);
        if (error) throw error;
      } else if (project.projectType === 'new' && project.floors >= 1) {
        const {error} = defaultBuildingElementValidator.defaultBEWithSlab.validate(body);
        if (error) throw error;
      }

      for (let item in body.defaultBE) {
        project.defaultBuildingElements[item] = body.defaultBE[item];
      }

      for (let itemInDB in project.defaultBuildingElements) {
        if (!body.defaultBE[itemInDB]) {
          delete project.defaultBuildingElements[itemInDB];
        }
      }

      project.markModified('defaultBuildingElements');
      await project.save();
      Log({ message: 'Default building elements have been successfully updated. ProjectID -> ' + params.projectId, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
      return res.status(200).send({project});
    } catch (e) {
      appCatchErrors(e,
        'ProjectsController -> setDefaultBuildingElements' ,
        '',
        ipAddress,
        res,
        user
      );
    }
  },


  /**
   * make project opened twice
   *
   * @param body
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @returns {Promise<*>}
   */

  changeOpenedStatus: async({body, headers, connection, user}, res) => {
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> changeOpenedStatus');
    try {
      const {error} = dynamicValidator.setFields({
        projectId: dynamicValidator.objectId,
      }).validate(body);
      if (error) throw error;

      const updatedProject = await projectService.updateProject({
        filter: {_id: body.projectId, userId: user._id, deleted: false},
        updater: {openedFirstTime: false}
      });
      if(!updatedProject) throw new AppSendError(projectNotFound);

      Log({ message: 'Project\'s openedFirstTime status changed successfully! projectId - ' + updatedProject._id, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
      return res.status(200).send({ success: true });
    } catch (e) {
      appCatchErrors(e,
        'ProjectsController -> changeOpenedStatus' ,
        '',
        ipAddress,
        res,
        user
      );
    }
  },

  /**
   * change Project Status
   *
   * @param params
   * @param body
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @returns {Promise<*>}
   */

  changeProjectStatus: async({params, body, headers, connection, user}, res) => {
    const {projectId} = params;
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> changeProjectStatus');
    try {
      const {error} = dynamicValidator.setFields({
        projectId: dynamicValidator.objectId,
      }).validate({projectId});
      if (error) throw error;

      const updatedProject = await projectService.updateProject({
        filter: {_id: projectId, userId: user._id, deleted: false},
        updater: {status: PROJECT_STATUS.CREATED}
      });
      if(!updatedProject) throw new AppSendError(projectNotFound);

      Log({ message: 'Project\'s status changed successfully! projectId - ' + updatedProject._id, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
      return res.status(200).send({ success: true });
    } catch (e) {
      appCatchErrors(e,
        'ProjectsController -> changeProjectStatus' ,
        '',
        ipAddress,
        res,
        user
      );
    }
  },

  /**
   * Is project In Second Step
   *
   * @param params
   * @param headers
   * @param connection
   * @param user
   * @param res
   * @returns {Promise<*>}
   */

  projectIsInSecondStep: async({params, headers, connection, user}, res) => {
    const {projectKey} = params;
    const ipAddress = getClientIp(headers, connection);
    consoleLog('ProjectsController -> projectIsInFirstStep');
    try {
      const {error} = dynamicValidator.setFields({
        projectKey: dynamicValidator.string,
      }).validate({projectKey});
      if (error) throw error;
      let isInSecondStep = false;
      const plannerResponse = await planner5dApi.getProjectByKey(projectKey);
      if (!plannerResponse) throw new AppSendError(projectNotFound);
      if (plannerResponse.result.items[0].data.projectType === PROJECT_TYPE.RENOVATION && plannerResponse.result.items[0].data.items[0].oldState) {
        isInSecondStep = true;
      }
      Log({ message: 'Get Project from Planner5d by key! projectKey - ' + projectKey, actionType: MESSAGE_TYPES.SUCCESS, user, ipAddress});
      return res.status(200).send({ isInSecondStep });
    } catch (e) {
      appCatchErrors(e,
        'ProjectsController -> projectIsInFirstStep' ,
        '',
        ipAddress,
        res,
        user
      );
    }
  },
};
