import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddCreatedPropertiesToBadgeTask';

export default class AddCreatedPropertiesToBadgeTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    const users = await UserStorage.getUsers(tenant.id, {}, Constants.DB_PARAMS_MAX_LIMIT);
    const tagCollection = global.database.getCollection<any>(tenant.id, 'tags');
    let counter = 0;
    for (const user of users.result) {
      const tags = await tagCollection.find({ userID: Utils.convertToObjectID(user.id), createdOn: null }).toArray();
      if (!Utils.isEmptyArray(tags) && user.createdOn) {
        for (const tag of tags) {
          await tagCollection.updateOne(
            {
              _id: tag._id
            },
            {
              $set: {
                createdOn: user.createdOn,
                createdBy: user.createdBy ? Utils.convertToObjectID(user.createdBy.id) : null
              }
            },
            { upsert: false }
          );
          counter++;
        }
      }
    }
    // Log in the default tenant
    if (counter > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${counter} Tags(s) have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AddCreatedPropertiesToBadgeTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
