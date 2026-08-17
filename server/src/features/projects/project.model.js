import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
    {
        name : {
            type : String,
            required : true,
        },

        TechStack : {
            type : [String],
            default : []
        },

        githubUrl : {
            type : String,
            default : ""
        }

        
    }

)