const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const WIOAQuestionnaireSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Personal Information
    socialSecurityNumber: {
      type: String,
      required: true,
    },

    socialSecurityImage: {
      type: String, // This will store the file path or URL to the image
      required: false, // Set to true if you want to require it
    },
    // Add driver's license image field
    driversLicenseImage: {
      type: String, // This will store the file path or URL to the image
      required: false, // Set to true if you want to require it
    },

    lastName: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    streetAddress: {
      type: String,
      required: true,
    },
    streetAddress2: String,
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    zipCode: {
      type: String,
      required: true,
    },

    // Equal Opportunity Information
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ["Male", "Female", "I Do Not Self-Identify", null],
      default: null,
    },
    hasDisability: {
      type: String,
      enum: ["Yes", "No", "I Do Not Self-Identify"],
      default: "No",
    },
    disabilityCategories: [
      {
        type: String,
        enum: [
          "Physical, Chronic Health Condition",
          "Physical, Mobility Impairment",
          "Mental or Psychiatric Disability",
          "Vision Related Disability",
          "Hearing Related Disability",
          "Learning Disability",
          "No Disability",
        ],
        default: "No Disability",
      },
    ],
    receivesSSDA: {
      type: String,
      enum: ["Yes", "No", null],
      default: null,
    },
    receivesLSMHA: {
      type: String,
      enum: ["Yes", "No", null],
      default: null,
    },
    receivesHCBSWaiver: {
      type: String,
      enum: ["Yes", "No", null],
      default: null,
    },
    ethnicity: [
      {
        type: String,
        enum: [
          "Hispanic or Latino",
          "Asian",
          "Native Hawaiian or Other Pacific Islander",
          "American Indian or Alaska Native",
          "Black or African-American",
          "White",
          null,
        ],
        default: null,
      },
    ],

    // Veteran Status
    isVeteran: {
      type: String,
      enum: ["Yes", "No", null],
      default: null,
    },
    isEligibleVeteran: {
      type: String,
      enum: ["Yes", "No", null],
      default: null,
    },
    eligibleVeteranConditions: [
      {
        type: String,
        enum: ["18-A", "18-B", "18-C", "18-D"],
        default: null,
      },
    ],
    isDisabledVeteran: {
      type: String,
      enum: ["Yes", "No", null],
      default: null,
    },
    disabledVeteranConditions: [
      {
        type: String,
        enum: ["19-A", "19-B"],
        default: null,
      },
    ],
    militarySeparationDate: Date,
    isTransitioningServiceMember: {
      type: String,
      enum: ["Yes", "No", null],
      default: null,
    },
    transitioningServiceMemberConditions: [
      {
        type: String,
        enum: ["21-A", "21-B"],
        default: null,
      },
    ],
    isHomelessVeteran: {
      type: String,
      enum: ["Yes", "No", null],
      default: null,
    },
    homelessVeteranConditions: [
      {
        type: String,
        enum: ["22-A", "22-B"],
        default: null,
      },
    ],
    veteranEmploymentBarriers: {
      type: String,
      enum: ["Yes", "No", null],
      default: null,
    },

    // Employment Information
    employmentStatus: {
      type: String,
      enum: [
        "Yes",
        "Yes, Terminated or Military Separation Pending",
        "Not Employed, Seeking Employment",
        "Not Employed, Not Seeking Employment",
        null,
      ],
      default: null,
    },
    unemployedLongerThan27Weeks: {
      type: String,
      enum: ["Yes", "No", null],
      default: null,
    },
    mostRecentOccupation: String,
    employmentSeparationDate: Date,
    monthsWorked: Number,
    isMigrantSeasonalFarmworker: {
      type: String,
      enum: [
        "Yes, Not Absent from Home Overnight",
        "Yes, I Travel to Job Site and Do Not Stay at Home",
        "Yes, Not Absent Overnight and Stay at Home",
        "Yes, Food Processing Worker",
        "No, None of the Above",
        null,
      ],
      default: null,
    },

    // Education Information
    highestSchoolGrade: {
      type: String,
      enum: [
        "1 – First",
        "2 – Second",
        "3 – Third",
        "4 – Fourth",
        "5 – Fifth",
        "6 – Sixth",
        "7 – Seventh",
        "8 – Eighth",
        "9 – Ninth",
        "10 – Tenth",
        "11 – Eleventh",
        "12 – Twelfth",
        "0 – Did Not Complete Any School Grades",
        null,
      ],
      default: null,
    },
    highestEducationLevel: {
      type: String,
      enum: [
        "Attained High School Diploma",
        "Attained High School Equivalency",
        "Completed One or More Years of Post-High School Education",
        "Attained Non-Degree Post-High School Technical or Vocational Certificate",
        "Attained an Associate's Degree",
        "Attained a Bachelor's Degree",
        "Attained a Degree Beyond Bachelor's",
        null,
      ],
      default: null,
    },
    currentSchoolStatus: {
      type: String,
      enum: [
        "Attending – High School",
        "Attending – Alternative School",
        "Attending – Post-High School",
        "Not Attending School or High School Dropout",
        "Not Attending School and Have a High School Diploma or Recognized Equivalent",
        "Not Attending School and Within Age of Texas Compulsory School Attendance and Have Not Attended for the Past 3 Months and Do Not have a High School Diploma or Recognized Equivalent",
        null,
      ],
      default: null,
    },

    // Public Assistance Information
    receivedTANF: {
      type: String,
      enum: ["Yes", "No", null],
      default: null,
    },
    nearTANFExhaustion: {
      type: String,
      enum: ["Yes", "No", null],
      default: null,
    },
    SSIAssistance: {
      type: String,
      enum: ["35-A", "35-B", "35-C", "35-D", "35-E", "35-F", "35-G", null],
      default: null,
    },
    otherPublicAssistance: {
      type: String,
      enum: ["36-A", "36-B", "36-C", null],
      default: null,
    },
    youngParentWithDependents: {
      type: String,
      enum: ["37-A", "37-C", null],
      default: null,
    },
    youngAdultStatus: {
      type: String,
      enum: ["38-A", "38-B", "38-C", null],
      default: null,
    },
    youngAdultFosterCareStatus: {
      type: String,
      enum: ["39-A", "39-B", "39-C", null],
      default: null,
    },
    homelessStatus: [
      {
        type: String,
        enum: [
          "40-A",
          "40-B",
          "40-C",
          "40-D",
          "40-E",
          "40-F",
          "40-G",
          "40-H",
          "40-I",
          null,
        ],
        default: null,
      },
    ],
    exOffenderStatus: {
      type: String,
      enum: ["41-A", "41-B", "41-C", null],
      default: null,
    },
    SNAPAssistance: {
      type: String,
      enum: ["42-A", "42-B", "42-C", null],
      default: null,
    },
    lowIncomeInformation: [
      {
        type: String,
        enum: ["43-A", "43-B", "43-C", "43-D", null],
        default: null,
      },
    ],
    englishLanguage: [
      {
        type: String,
        enum: ["44-A", "44-B", "44-C", "44-D", null],
        default: null,
      },
    ],
    culturalBarrier: {
      type: String,
      enum: ["45-A", "45-B", "45-C", null],
      default: null,
    },
    singleParent: {
      type: String,
      enum: ["46-A", "46-B", "46-C", "46-D", null],
      default: null,
    },
    displacedHomemaker: {
      type: String,
      enum: ["47-A", "47-B", null],
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("WIOAQuestionnaire", WIOAQuestionnaireSchema);
