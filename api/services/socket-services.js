const socketIo = require('socket.io');
const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');

let io;

async function updateSocketId(email, newSocketId) {
    let query = `SELECT socket_id FROM users WHERE email = '${email}'`;
    let rows = await sequelize.query(query, { type: QueryTypes.SELECT });

    if (rows.length === 0) {
        console.log('User not found');
        return false;
    }

    const socketIdInDb = rows[0].socket_id;

    if (socketIdInDb && io.sockets.sockets.get(socketIdInDb)) {
        console.log(`Reusing active socket ID for ${email}`);
        return true;
    };

    let updateQuery = `UPDATE users SET socket_id = '${newSocketId}' WHERE email = '${email}'`;
    await sequelize.query(updateQuery, { type: QueryTypes.UPDATE });
    console.log(`Socket ID updated for ${email}`);
    return true;
};

async function sendNotificationByEmail(email , topic , title , body , image , link) {
    let query = `SELECT socket_id FROM users WHERE email = '${email}'`;
    let rows = await sequelize.query(query, { type: QueryTypes.SELECT });
    let message = "";
    let code = 200;

    if (rows.length === 0) {
        console.log('No user found with email:', email);
        message = `No user found with email:', ${email}`;
        code = 400;
        return { message, code };
    }

    const socketId = rows[0].socket_id;
    const notification = {
        topic : topic ,
        title : title , 
        body : body ,
        image : image ,
        link : link
    }
    if (socketId && io.sockets.sockets.get(socketId)) {
        io.to(socketId).emit('notification', notification);
        message = `Notification sent to ${email}`;
    } else {
        console.log(`No active socket found for ${email}`);
        message = `No active socket found for ${email}`;
        code = 400;
    }
    return { message, code };
};

function initSocket(server) {
    io = socketIo(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    io.on('connection', (socket) => {
        // console.log('A user connected:', socket.id);

        socket.on('register', async (email) => {
            await updateSocketId(email, socket.id);
        });

        socket.on('notification', async (email, notification) => {
            await sendNotificationByEmail(email, notification);
        });

        socket.on('disconnect', async () => {
            // console.log('User disconnected:', socket.id);
            let query = ` UPDATE users SET socket_id = NULL WHERE socket_id = '${socket.id}' `;
            await sequelize.query(query, { type: QueryTypes.UPDATE });
        });

        socket.on('notification-read' , async (email , notificationId) => {
            //TODO: update notification status to read
            console.log(email , notificationId , ":log:data");
        })
        
    });
};

function broadcastMessage(topic, data) {
    if (io?.sockets?.sockets?.size > 0) {
        io.emit(topic, data);
        return true;
    }
}

module.exports = {
    initSocket,
    sendNotificationByEmail,
    broadcastMessage,
};

