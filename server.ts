import express from 'express';
import { Server as HttpServer } from 'http';
import { Server as IoServer, Socket } from 'socket.io';
import { ClientUpdateLocation, EventClientUpdateLocation, EventServerUpdateClientDisconnected, EventServerUpdateClientLocation, ServerUpdateClientDisconnected, ServerUpdateClientLocation } from './src/world/network/api';

const app = express();

const server = new HttpServer(app);

const io = new IoServer(server, {
	cors: {
		origin: '*',
	}
});

const newConnection = (socket: Socket) => {
	console.log('User connect: ' + socket.id);

	socket.on(EventClientUpdateLocation, (data: ClientUpdateLocation) => {
		const broadcastResponse: ServerUpdateClientLocation = {
			id: socket.id,
			position: data.position,
			rotation: data.rotation,
		};
		socket.broadcast.volatile.emit(EventServerUpdateClientLocation, broadcastResponse);
	});

	socket.on('disconnect', () => {
		console.log('User disconnect: ' + socket.id);
		const broadcastResponse: ServerUpdateClientDisconnected = {
			id: socket.id,
		};
		socket.broadcast.volatile.emit(EventServerUpdateClientDisconnected, broadcastResponse);
	});
}

io.on('connection', newConnection);

const port = process.env.PORT || 8080;
server.listen(port, () => {
	console.log(`listening on ${port}...`)
});
