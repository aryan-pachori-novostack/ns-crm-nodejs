const { MongoClient, ObjectId } = require('mongodb');
const url = process.env.MONGO_MIS_URI;
const dbNameNotification = 'notification_event_logs';
const collectionNameNotification = 'dl_push_notification_socket';
const { v4: uuid } = require('uuid');

const getSequence = () => {
  return uuid().replace(/-/g, '');
};
async function getPushNotifcationData(email, page, pageSize) {
  let client;
  try {
    client = new MongoClient(url);
    await client.connect();
    const db = client.db(dbNameNotification);
    const collection = db.collection(collectionNameNotification);
    const query = {
      isRead: false,
      email: email
    };
    const totalCount = await collection.countDocuments(query);
    const projection = { _id: 1, title: 1, body: 1, link: 1, image: 1 , ts:1 };
    const skipCount = (page - 1) * pageSize;
    const result = await collection
      .find(query)
      .project(projection)
      .sort({ ts: -1 })
      .skip(skipCount)
      .limit(pageSize)
      .toArray();
    return {
      result: result,
      totalCount: totalCount
    };
  } catch (error) {
    console.error('Error retrieving data:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
};

async function getPushNotifcationDataReaded(email, page, pageSize) {
  let client;
  try {
    client = new MongoClient(url);
    await client.connect();
    const db = client.db(dbNameNotification);
    const collection = db.collection(collectionNameNotification);
    const query = {
      isRead: true,
      email: email
    };

    const projection = { _id: 1, title: 1, body: 1, link: 1, image: 1 ,ts:1};
    const skipCount = (page - 1) * pageSize;
    const result = await collection
      .find(query)
      .project(projection)
      .sort({ ts: -1 })
      .skip(skipCount)
      .limit(pageSize)
      .toArray();


    return {
      result: result
    }
  } catch (error) {
    console.error('Error retrieving data:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
};

async function setPushNotificationData(id) {
  let client;
  try {
    client = new MongoClient(url);
    await client.connect();
    const db = client.db(dbNameNotification);
    const collection = db.collection(collectionNameNotification);
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: { isRead: true },
      },
      { upsert: true }
    );
    console.log(result)
    if (result.matchedCount > 0) {
      console.log(`Notification with id ${id} updated.`);
    } else {
      console.log(`Notification with id ${id} created and marked as read.`);
    }
  } catch (error) {
    console.error('Error updating or creating notification:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
};
async function getNotificationStats(category, type, startDate, endDate, getDetails = false, pageNumber = 0, pageSize = 10) {
  const notificationTypes = {
    email: ["dl_email", "in_email"],
    whatsapp: ["dl_whatsapp_notification", "in_whatsapp_notification"],
    push: ["dl_push_notification_socket", "in_push_notification_socket"],
    sms: ["dl_sms_notification", "in_sms_notification"],
    app: ["dl_app_notification", "in_app_notification"],
    calling: ["dl_bulk_calling", "in_bulk_calling"],
  };

  let client;
  try {
    client = new MongoClient(url);
    await client.connect();
    const db = client.db(dbNameNotification);

    let collections = await db.listCollections().toArray();
    collections = collections.map(col => col.name);

    let selectedCollections = collections;
    if (category === "delivered") {
      selectedCollections = collections.filter(name => name.startsWith("dl_"));
    } else if (category === "incoming") {
      selectedCollections = collections.filter(name => name.startsWith("in_"));
    }

    if (type && notificationTypes[type]) {
      selectedCollections = selectedCollections.filter(name => notificationTypes[type].includes(name));
    }

    let totalCount = 0;
    let collectionCounts = {};
    let notificationData = [];

    for (const collectionName of selectedCollections) {
      const collection = db.collection(collectionName);
      let filter = {};

      if (startDate || endDate) {
        filter.ts = {};
        if (startDate) filter.ts.$gte = new Date(startDate);
        if (endDate) filter.ts.$lte = new Date(endDate);
      }

      const count = await collection.countDocuments(filter);
      totalCount += count;
      collectionCounts[collectionName] = count;
      if (getDetails) {
        const skip = Math.max(pageNumber, 0) * pageSize;
        const documents = await collection.find(filter).skip(skip).sort({ ts: -1 }).limit(pageSize).toArray();
        notificationData.push(...documents);
      }
    }

    return getDetails
      ? { totalCount, collectionCounts, records: notificationData }
      : { totalCount, collectionCounts };

  } catch (error) {
    console.error("Error fetching notification counts:", error);
    return getDetails
      ? { totalCount: 0, collectionCounts: {}, records: [] }
      : { totalCount: 0, collectionCounts: {} };
  } finally {
    if (client) await client.close();
  }
}
async function getActivityLogsMongo(pageNumber = 0, pageSize = 10, scope, custId, eventTypes) {

  let client;
  try {
    client = new MongoClient(url);
    await client.connect();
    const db = client.db("ruloans");
    const collection = db.collection("logs");

    const query = {};
    if (scope){
      query.scope = scope;
      query.ref_id = custId;
    }
    if (Array.isArray(eventTypes) && eventTypes.length) {
      query.event = { $in: eventTypes };
    }

    const sort = { createdAt: -1 };

    const skip = Math.max(pageNumber, 0) * pageSize;
    
    const totalRecords = await collection.countDocuments(query);

    
    const results = await collection.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .toArray();
     

    return { totalRecords,  results};
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return { totalCount: 0, records: [] }; // Return empty result in case of error
  } finally {
    if (client) await client.close();
  }
}
async function storeUsersInMongoDB(users) {
  try {

    if (!users || users.length === 0) {
      return;
    }


    const processedUsers = users.map((user) => ({
      ...user,
      nid: getSequence(),
      ts: new Date(),
    }));

    client = new MongoClient(url);
    await client.connect();


    const db = client.db(dbNameNotification);
    const collection = db.collection("in_bulk_calling");

    const result = await collection.insertMany(processedUsers);

    console.log("Users stored successfully in 'in_bulk_calling':", result);
    return result;
  } catch (error) {
    console.error("Error storing users in MongoDB:", error);
    throw error; // Re-throw the error for handling in the calling function
  }
};
async function markAllasReadNotificationMongo(email) {

  try {
    client = new MongoClient(url);
    await client.connect();
    const db = client.db(dbNameNotification);
    const collection = db.collection(collectionNameNotification);
    const query = { email: email, isRead: false };
    const update = { $set: { isRead: true } };

    const result = await collection.updateMany(query, update);
    console.log("Notifications marked as read successfully:", result);
    return result;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

module.exports = {
  markAllasReadNotificationMongo,
  storeUsersInMongoDB,
  getNotificationStats,
  getPushNotifcationDataReaded,
  setPushNotificationData,
  getPushNotifcationData,
  getActivityLogsMongo
};
