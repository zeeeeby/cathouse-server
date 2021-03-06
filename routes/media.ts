import { Router } from 'express';
import authController from '../controllers/auth.controller';
import mediaController from '../controllers/media.controller';
import { upload } from '../multer';
import fetch from 'node-fetch';
const router = Router();

const permitted = ['http://localhost:3000/', 'https://cathouse.vercel.app/'];
router
    .get('/:path', async (req, res) => {
        if (!permitted.includes(req.headers.referer)) {
            res.sendStatus(404);
        } else {
            const response = await fetch(
                `${process.env.IMAGE_REMOTE_URL}/${req.url}`,
                {
                    headers: {
                        Authorization: 'token ' + process.env.GH_ACCESS_TOKEN,
                    },
                }
            );
            res.set({ 'content-type': response.headers.get('content-type') });
            res.send(await response.buffer());
        }
    })
    .delete('/', authController.checkAuth(), mediaController.removeMedia)
    .post(
        '/',
        upload.fields([{ name: 'image', maxCount: 10 }]),
        mediaController.uploadToRemoteServer,
        (req, res) => {
            //@ts-ignore
            return res.json([...req.files.map((file) => file.filename)]);
        }
    )
    .post('/attach', authController.checkAuth(), mediaController.attachMedia);

export default router;
