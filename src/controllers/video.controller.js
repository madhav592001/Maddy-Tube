import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const uploadVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    const owner = req.user._id

    if(!(title && description)) {
        throw new ApiError(400, "Mandatory fields are missing")
    }

    if(!(req.files?.videoFile && req.files?.thumbnail)) {
        throw new ApiError(400, "Video file and thumbnail are required")
    } 

    const videoFile = await uploadOnCloudinary(req.files?.videoFile[0]?.path)
    const thumbnail = await uploadOnCloudinary(req.files?.thumbnail[0]?.path)

    if(!(videoFile || thumbnail)) {
        throw new ApiError(500, "Cloudinary error")
    }

    const newVideo = await Video.create({
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        title,
        description,
        owner,      
        duration: videoFile.duration,
    })

    const savedVideo = await Video.findById(newVideo._id)

    if(!savedVideo) {
        throw new ApiError(500, "Error while saving video")
    }

    return res.status(201).json(new ApiResponse(true, "Video uploaded successfully", newVideo))
})

const watchVideo = asyncHandler(async (req, res) => {

    const { videoId } = req.params
    const userId = req.user._id

    if(!videoId) {
        throw new ApiError(400, "Video ID is required")
    }

    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } }, { new: true })

    await User.findByIdAndUpdate(userId, { $push: { watchHistory: videoId } }, { new: true })

    return res.status(200).json(new ApiResponse(200, "Video watched successfully"))
})

export { uploadVideo, watchVideo }