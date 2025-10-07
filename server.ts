import express from 'express';
import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import fs from 'fs';
import path from 'path';
import { Server as IoServer, Socket } from 'socket.io';
import { ClientUpdateBody, ClientUpdateLocation, EventClientUpdateBody, EventClientUpdateLocation, EventServerUpdateClientBody, EventServerUpdateClientDisconnected, EventServerUpdateClientLocation, ServerUpdateClientBody, ServerUpdateClientDisconnected, ServerUpdateClientLocation } from './src/world/network/api';

const app = express();

app.use(express.static(path.join(__dirname, `build`)))

// Use HTTPS in development
const isDev = process.env.ENV === 'development';
let server: HttpServer | HttpsServer;

if (isDev) {
	try {
		// Try to use the same certificates that react-scripts generates
		const certPath = path.join(process.env.HOME || '', '.localhost-ssl');
		const httpsOptions = {
			key: fs.readFileSync(path.join(certPath, 'localhost-key.pem')),
			cert: fs.readFileSync(path.join(certPath, 'localhost.pem'))
		};
		server = new HttpsServer(httpsOptions, app);
		console.log('HTTPS enabled for development');
	} catch (err) {
		console.log('HTTPS certificates not found, falling back to HTTP');
		server = new HttpServer(app);
	}
} else {
	server = new HttpServer(app);
}

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
	const protocol = server instanceof HttpsServer ? 'https' : 'http';
	console.log(`listening on ${protocol}://localhost:${port}...`)
});
