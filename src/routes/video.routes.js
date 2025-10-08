import { Router } from 'express'
import { upload } from '../middlewares/multer.middleware.js'
import { verifyJWT } from '../middlewares/auth.middleware.js'
import { uploadVideo, watchVideo } from '../controllers/video.controller.js'

const router = Router()

router.route("/upload").post(verifyJWT, upload.fields(
    [
        {
            name: "videoFile", 
            maxCount:1
        },
        {
            name: "thumbnail", 
            maxCount:1
        }
    ]
), uploadVideo)

router.route("/watch/:videoId").patch(verifyJWT, watchVideo)

export default router