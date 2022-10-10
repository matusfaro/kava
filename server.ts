import express from 'express';
import { Server as HttpServer } from 'http';
import path from 'path';
import { Server as IoServer, Socket } from 'socket.io';
import { ClientUpdateBody, ClientUpdateLocation, EventClientUpdateBody, EventClientUpdateLocation, EventServerUpdateClientBody, EventServerUpdateClientDisconnected, EventServerUpdateClientLocation, ServerUpdateClientBody, ServerUpdateClientDisconnected, ServerUpdateClientLocation } from './src/world/network/api';

const app = express();

app.use(express.static(path.join(__dirname, `build`)))

const server = new HttpServer(app);

const io = new IoServer(server, {
	cors: {
		origin: '*',
	}
});

const newConnection = (socket: Socket) => {
	console.log('User connect: ' + socket.id);

	socket.on(EventClientUpdateBody, (data: ClientUpdateBody) => {
		// console.log(`Client ${socket.id} update body`,);
		const broadcastResponse: ServerUpdateClientBody = {
			id: socket.id,
			...data,
		};
		socket.broadcast.volatile.emit(EventServerUpdateClientBody, broadcastResponse);
	});

	socket.on(EventClientUpdateLocation, (data: ClientUpdateLocation) => {
		// console.log(`Client ${socket.id} update location`,);
		const broadcastResponse: ServerUpdateClientLocation = {
			id: socket.id,
			...data,
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
