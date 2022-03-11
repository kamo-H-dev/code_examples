const { Project } = require('../models');
const { consoleLog } = require('../services/utilsService');
const projectStatuses = require('../constants').PROJECT_STATUS;

module.exports = {

  /**
   * Get project by query service
   *
   * @param query {object}
   * @return {Promise<never>}
   */
  getProjectByQuery: (query) => {
    return Project.findOne(query).select('-planner5dData');
  },

  /**
   * Get only isManual field
   *
   * @param id
   * @return {*}
   */
  getProjectIsManual: (id) => {
    return Project.findOne({_id: id}).select('isManual').lean();
  },

  /**
   * Get project by query With BuildingElements
   *
   * @param query {object}
   * @return {Promise<never>}
   */
  getProjectWithBuildingElement: async (query) => {
    return Project.findOne(query).select('-planner5dData')
      .populate({path: 'userId', select: {name: 1, address: 1, phone: 1, roleType: 1, 'organizationData.organizationName': 1}})
      .populate({path: 'organizationId', select: {'organizationData.organizationName': 1, roleType: 1}})
      .populate({path: 'buildingElements.buildingElementId', match: { deleted: { $ne: true } }, select: {productResults: 0}
      }).populate({path: 'buildingElements.productResults.productResultId', match: { deleted: {$ne: true} }, select: {price: 1, resources: 1, time: 1, id: 1, title: 1, unit: 1}, populate: {
        path: 'resources.resourceId',
        select: {price: 1, type: 1, name: 1}
    }}).populate({path: 'demolishBuildingElements.buildingElementId', match: { deleted: { $ne: true } }, select: {demolishedProductResults: 0}
    }).populate({path: 'demolishBuildingElements.productResults.productResultId', match: { deleted: {$ne: true} }, select: {price: 1, resources: 1, time: 1, id: 1, title: 1, unit: 1}, populate: {
        path: 'resources.resourceId',
        select: {price: 1, type: 1, name: 1}
    }});
  },

  /**
   * Create a new project
   * @param data {object}
   * @return {Promise<void|Promise|*>}
   */
  createProject: async (data) => {
    const project = new Project({...data});
    return project.save();
  },

  /**
   * Get projects by query or all
   *
   * @param query
   * @return {Promise<*>}
   */
  getProjects: async (query = {}, deleted = true) => {
    if (!deleted) {
      query.deleted = false;
    }
    return Project.find(query).sort('-createdAt').populate('userId', 'name').select('-planner5dData').lean();
  },

  /**
   * get count of project by filer
   * @param filter
   * @returns {*}
   */
  getProjectsCount: (filter) => {
    console.log('projectService -> getCount -> filter: ', filter);
    return Project.countDocuments(filter);
  },

  /**
   * get projects count by userId
   * @param arrayOfIds
   * @returns {*}
   */
  getProjectsByUserId: (arrayOfIds) => {
    consoleLog('projectService -> getProjectsByUserId -> arrayOfIds ');
    return Project.aggregate( [
      {$match: {
          userId: {
            $in: arrayOfIds,
          },
          deleted: false,
          status: {$ne: projectStatuses.WAITING},
        }
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
        }
      },
      {
        $project: {
          'planner5dData': 0,
        },
      }
    ]);
  },

  /**
   * get projects count by organizationId
   * @param arrayOfIds
   * @returns {*}
   */
  getProjectsByOrganizationId: (arrayOfIds) => {
    consoleLog('projectService -> getProjectsByOrganizationId -> arrayOfIds ');
    return Project.aggregate( [
      {$match: {
          organizationId: {
            $in: arrayOfIds,
          },
          deleted: false,
          status: {$ne: projectStatuses.PENDING},
        }
      },
      {
        $group: {
          _id: '$organizationId',
          count: { $sum: 1 },
        }
      },
      {
        $project: {
          'planner5dData': 0,
        },
      }
    ]);
  },

  /**
   * Get project by filter and update
   *
   * @param query {object}
   * @return {Promise<never>}
   */
  updateProject: ({filter, updater}) => {
    consoleLog('projectService -> updateProject');
    return Project.findOneAndUpdate(filter , updater, {new: true});
  },


  /**
   *
   * @param {string} organizationId
   * @return {Document|Query}
   */
  getPendingProjects: (organizationId) => {
    return Project.find({organizationId: organizationId, status: projectStatuses.PENDING}).select('-planner5dData')
      .populate({path: 'buildingElements.buildingElementId', match: { deleted: { $ne: true } }, select: {productResults: 0}
      }).populate({path: 'buildingElements.productResults.productResultId', match: { deleted: {$ne: true} }, select: {price: 1, resources: 1, time: 1, id: 1, title: 1, unit: 1}, populate: {
          path: 'resources.resourceId',
          select: {price: 1, type: 1, name: 1}
        }});
  },

  /**
   *Get project with elements by id
   *
   * @param {string} projectId
   * @return {Document|Query}
   */
  getProjectByIdWithElements: (projectId) => {
    return Project.findOne({_id: projectId}).select('-planner5dData')
      .populate({path: 'buildingElements.buildingElementId', match: { deleted: { $ne: true } }, select: {productResults: 0}
      }).populate({path: 'buildingElements.productResults.productResultId', match: { deleted: {$ne: true} }, select: {price: 1, resources: 1, time: 1, id: 1, title: 1, unit: 1}, populate: {
          path: 'resources.resourceId',
          select: {price: 1, type: 1, name: 1}
        }});
  },

  /**
   * Get projects by elements for updating costs
   *
   * @param elementIds
   * @return {Query|*}
   */
  getProjectByElementIds: (elementIds) => {
    return Project.find({'buildingElements.buildingElementId': {$in: elementIds}, deleted: {$ne: true}, status: {$nin: [projectStatuses.ACCEPTED, projectStatuses.COMPLETED]}}).select('_id userId')
      .populate({path: 'userId', select: {name: 1, roleType: 1, organizationData: 1}}).lean();
  },

  /**
   * get projects by deleted building element id to updated project building elements
   *
   * @param elementId
   * @return {*}
   */
  getProjectsByElementId: (elementId) => {
    return Project.find({'buildingElements.buildingElementId': elementId, deleted: {$ne: true}, status: {$nin: [projectStatuses.ACCEPTED, projectStatuses.COMPLETED]}})
      .select('_id userId buildingElements')
      .populate({path: 'userId', select: {name: 1, roleType: 1, organizationData: 1}}).lean();
  },

  /**
   * Bulk update building elements from projects
   *
   * @param elementId
   * @param projects
   * @return {*}
   */
  removeBElementsFromProjects: (elementId, projects) => {
    return Project.bulkWrite(
      projects.map((res) =>{
        res.buildingElements.splice(res.buildingElements.findIndex(i => i.buildingElementId.toString() === elementId), 1);
        return {
          updateOne: {
            filter: {_id: res._id},
            update: {$set: {buildingElements: res.buildingElements}},
            // upsert: true,
          }
        };
      })
      ,{ordered: false});
  }
};
