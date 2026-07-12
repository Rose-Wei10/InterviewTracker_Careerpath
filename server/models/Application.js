//models/Application.js

const mongoose=require("mongoose")

const ApplicationSchema=new mongoose.Schema({

company:{
type:String,
required:true
},

position:{
type:String,
required:true
},

status:{
type:String,
enum:[
"Applied",
"Interview",
"Offer",
"Rejected"
],
default:"Applied"
},

priority:{
type:String,
enum:[
"Low",
"Medium",
"High"
],
default:"Medium"
},

interviewDate:Date,

createdAt:{
type:Date,
default:Date.now
}

})

module.exports=mongoose.model(
"Application",
ApplicationSchema
)