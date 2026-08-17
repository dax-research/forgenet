import mongoose from "mongoose";
const userSchema = new mongoose.Schema(
    {
        name : {
            type : String,
            required : true,
            trim : true
        },

        email : {
            type : String,
            required : true,
            unique : true,
            lowercase : true,
            trim : true
        },

        password : {
            type : String,
            required : true,
        },

        profileImage : {
            type : String,
            default : ""
        },

        bio : {
            type : String,
            default : ""
        },

        skills : {
            type : [String],
            default : []
        },

        githubUrl : {
            type : String,
            default : ""
        },

        portfolioUrl : {
            type : String,
            default : ""
        },

        isJobSeeking : {
            type : Boolean,
            default : false
        },

        followers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        following: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ]
    },

    {
        timestamps: true
    }
)

export default mongoose.model("User", userSchema);