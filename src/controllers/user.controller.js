import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})   
        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, "Failed to generate tokens")
    }
}

const registerUser = asyncHandler(async (req, res) => {

    const { fullname, username, email, password } = req.body

    if([fullname, username, email, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "Fullname is required")
    }

    const existedUser = await User.findOne({$or: [{email}, {username}]})

    if(existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path
    
    let coverImageLocalPath
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : undefined

    if(!avatar) {
        throw new ApiError(500, "Failed to upload avatar")
    }

    const user = await User.create({
        fullname,
        username: username.toLowerCase(),
        email,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        password,
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if(!createdUser) {
        throw new ApiError(500, "Failed to create user")
    }

    return res.status(201).json(new ApiResponse(201, "User created successfully", createdUser))
})

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body

    if(!(username || email)) {
        throw new ApiError(400, "Email or username is required")
    }

    const user = await User.findOne({$or: [{email}, {username}]})

    if(!user) {
        throw new ApiError(404, "User not found")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid) {
        throw new ApiError(401, "Invalid password")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
            .status(200)
            .cookie("refreshToken", refreshToken, options)
            .cookie("accessToken", accessToken, options)
            .json(new ApiResponse(200, "User logged in successfully", {user:loggedInUser, accessToken, refreshToken}))
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
            req.user._id,
            {
                $unset: { refreshToken: 1 },
            },
            { new: true }
    )
    const options = {
        httpOnly: true,
        secure: true,
    }
    return res.status(200).clearCookie("refreshToken", options).clearCookie("accessToken", options).json(new ApiResponse(200, "User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken
    if(!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is missing")
    }

    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

    const user = await User.findById(decodedToken?._id)

    if(!user) {
        throw new ApiError(401, "Invalid refresh token")
    }

    if(user?.refreshToken !== incomingRefreshToken) {
        throw new ApiError(401, "Invalid refresh token")
    }

    const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    const options = {
        httpOnly: true,
        secure: true
    }
    return res
            .status(200)
            .cookie("refreshToken", newRefreshToken, options)
            .cookie("accessToken", accessToken, options)
            .json(new ApiResponse(200, "Access token refreshed successfully", {user:user,accessToken, newRefreshToken}))
})

export {registerUser, loginUser, logoutUser, refreshAccessToken}