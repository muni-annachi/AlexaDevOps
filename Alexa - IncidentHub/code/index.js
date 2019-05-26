/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');
const questions = require('./questions');
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const uuid = require('uuid');
const http = require('http');

const ANSWER_COUNT = 4;
const GAME_LENGTH = 5;

function populateGameQuestions(translatedQuestions) {
  const gameQuestions = [];
  const indexList = [];
  let index = translatedQuestions.length;
  if (GAME_LENGTH > index) {
    throw new Error('Invalid Game Length.');
  }

  for (let i = 0; i < translatedQuestions.length; i += 1) {
    indexList.push(i);
  }

  for (let j = 0; j < GAME_LENGTH; j += 1) {
    const rand = Math.floor(Math.random() * index);
    index -= 1;

    const temp = indexList[index];
    indexList[index] = indexList[rand];
    indexList[rand] = temp;
    gameQuestions.push(indexList[index]);
  }
  return gameQuestions;
}

function populateRoundAnswers(
  gameQuestionIndexes,
  correctAnswerIndex,
  correctAnswerTargetLocation,
  translatedQuestions
) {
  const answers = [];
  const translatedQuestion = translatedQuestions[gameQuestionIndexes[correctAnswerIndex]];
  const answersCopy = translatedQuestion[Object.keys(translatedQuestion)[0]].slice();
  let index = answersCopy.length;

  if (index < ANSWER_COUNT) {
    throw new Error('Not enough answers for question.');
  }

  // Shuffle the answers, excluding the first element which is the correct answer.
  for (let j = 1; j < answersCopy.length; j += 1) {
    const rand = Math.floor(Math.random() * (index - 1)) + 1;
    index -= 1;

    const swapTemp1 = answersCopy[index];
    answersCopy[index] = answersCopy[rand];
    answersCopy[rand] = swapTemp1;
  }

  // Swap the correct answer into the target location
  for (let i = 0; i < ANSWER_COUNT; i += 1) {
    answers[i] = answersCopy[i];
  }
  const swapTemp2 = answers[0];
  answers[0] = answers[correctAnswerTargetLocation];
  answers[correctAnswerTargetLocation] = swapTemp2;
  return answers;
}

function isAnswerSlotValid(intent) {
  const answerSlotFilled = intent
    && intent.slots
    && intent.slots.Answer
    && intent.slots.Answer.value;
  const answerSlotIsInt = answerSlotFilled
    && !Number.isNaN(parseInt(intent.slots.Answer.value, 10));
  return answerSlotIsInt
    && parseInt(intent.slots.Answer.value, 10) < (ANSWER_COUNT + 1)
    && parseInt(intent.slots.Answer.value, 10) > 0;
}

function handleUserGuess(userGaveUp, handlerInput) {
  const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
  const { intent } = requestEnvelope.request;

  const answerSlotValid = isAnswerSlotValid(intent);

  let speechOutput = '';
  let speechOutputAnalysis = '';

  const sessionAttributes = attributesManager.getSessionAttributes();
  const gameQuestions = sessionAttributes.questions;
  let correctAnswerIndex = parseInt(sessionAttributes.correctAnswerIndex, 10);
  let currentScore = parseInt(sessionAttributes.score, 10);
  let currentQuestionIndex = parseInt(sessionAttributes.currentQuestionIndex, 10);
  const { correctAnswerText } = sessionAttributes;
  const requestAttributes = attributesManager.getRequestAttributes();
  const translatedQuestions = requestAttributes.t('QUESTIONS');


  if (answerSlotValid
    && parseInt(intent.slots.Answer.value, 10) === sessionAttributes.correctAnswerIndex) {
    currentScore += 1;
    speechOutputAnalysis = requestAttributes.t('ANSWER_CORRECT_MESSAGE');
  } else {
    if (!userGaveUp) {
      speechOutputAnalysis = requestAttributes.t('ANSWER_WRONG_MESSAGE');
    }

    speechOutputAnalysis += requestAttributes.t(
      'CORRECT_ANSWER_MESSAGE',
      correctAnswerIndex,
      correctAnswerText
    );
  }

  // Check if we can exit the game session after GAME_LENGTH questions (zero-indexed)
  if (sessionAttributes.currentQuestionIndex === GAME_LENGTH - 1) {
    speechOutput = userGaveUp ? '' : requestAttributes.t('ANSWER_IS_MESSAGE');
    speechOutput += speechOutputAnalysis + requestAttributes.t(
      'GAME_OVER_MESSAGE',
      currentScore.toString(),
      GAME_LENGTH.toString()
    );

    return responseBuilder
      .speak(speechOutput)
      .getResponse();
  }
  currentQuestionIndex += 1;
  correctAnswerIndex = Math.floor(Math.random() * (ANSWER_COUNT));
  const spokenQuestion = Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0];
  const roundAnswers = populateRoundAnswers(
    gameQuestions,
    currentQuestionIndex,
    correctAnswerIndex,
    translatedQuestions
  );
  const questionIndexForSpeech = currentQuestionIndex + 1;
  let repromptText = requestAttributes.t(
    'TELL_QUESTION_MESSAGE',
    questionIndexForSpeech.toString(),
    spokenQuestion
  );

  for (let i = 0; i < ANSWER_COUNT; i += 1) {
    repromptText += `${i + 1}. ${roundAnswers[i]}. `;
  }

  speechOutput += userGaveUp ? '' : requestAttributes.t('ANSWER_IS_MESSAGE');
  speechOutput += speechOutputAnalysis
    + requestAttributes.t('SCORE_IS_MESSAGE', currentScore.toString())
    + repromptText;

  const translatedQuestion = translatedQuestions[gameQuestions[currentQuestionIndex]];

  Object.assign(sessionAttributes, {
    speechOutput: repromptText,
    repromptText,
    currentQuestionIndex,
    correctAnswerIndex: correctAnswerIndex + 1,
    questions: gameQuestions,
    score: currentScore,
    correctAnswerText: translatedQuestion[Object.keys(translatedQuestion)[0]][0]
  });

  return responseBuilder.speak(speechOutput)
    .reprompt(repromptText)
    .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
    .getResponse();
}


async function handleCreate(handlerInput) {
    const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
    const { intent } = requestEnvelope.request;
    const requestAttributes = attributesManager.getRequestAttributes();
  
    var incDesc = intent.slots.description.value;
    var incPriority = intent.slots.priority.value;
    var timestamp = new Date().getTime();
    var userId =  'Muni';
    let speechOutput = '';
    let repromptText = '';
    if(typeof(incDesc) != "undefined" && typeof(incPriority) != "undefined"){

        console.log("\n\nLoading handler\n\n");
  
        const dynamodbParams = {
          TableName: 'DYNAMODB_TABLE_EXPENSES',
          Item: {
            id: uuid.v4(),
            userId: userId,
            incDesc: incDesc,
            priority:incPriority,
            createdAt: timestamp,
            updatedAt: timestamp,
            incStatus: 'open'
          },
        };
  
      console.log('Attempting to add incident', dynamodbParams);  
      let createdIncident = "";
      try{
        createdIncident = await dynamoDb.put(dynamodbParams).promise();
         console.log('incident saved: ', createdIncident);
        speechOutput += requestAttributes.t('ADDED_INCIDENT_MESSAGE', intent.slots.description.value);
        return responseBuilder.speak(speechOutput)
        .reprompt(repromptText)
        .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
        .getResponse();
        
      }catch(err)
      {
         console.error(err);
        speechOutput += requestAttributes.t('ANSWER_IS_MESSAGE', intent.slots.description.value);
        return responseBuilder.speak(speechOutput)
        .reprompt(repromptText)
        .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
        .getResponse();
      }
    }
    /*  dynamoDb.put(dynamodbParams).promise()
      .then(data => {
        console.log('incident saved: ', dynamodbParams);
        speechOutput += requestAttributes.t('ADDED_INCIDENT_MESSAGE', intent.slots.description.value);
        return responseBuilder.speak(speechOutput)
        .reprompt(repromptText)
        .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
        .getResponse();
      })
      .catch(err => {
        console.error(err);
        speechOutput += requestAttributes.t('ANSWER_IS_MESSAGE', intent.slots.description.value);
        return responseBuilder.speak(speechOutput)
        .reprompt(repromptText)
        .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
        .getResponse();
      });
  
      } 
      
   // const translatedQuestion = translatedQuestions[gameQuestions[currentQuestionIndex]];
  
   /* Object.assign(sessionAttributes, {
      speechOutput: repromptText,
      repromptText,
      currentQuestionIndex,
      correctAnswerIndex: correctAnswerIndex + 1,
      questions: gameQuestions,
      score: currentScore,
      correctAnswerText: translatedQuestion[Object.keys(translatedQuestion)[0]][0]
    });*/
    
    speechOutput += requestAttributes.t('ADDED_INCIDENT_MESSAGE', intent.slots.description.value);
    repromptText += requestAttributes.t('WHAT_NEXT_MESSAGE');
    return responseBuilder.speak(speechOutput).reprompt(repromptText).getResponse();
    
  }

  async function handleRead(handlerInput) {
    const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
    const { intent } = requestEnvelope.request;
    const requestAttributes = attributesManager.getRequestAttributes();
   
    let speechOutput = '';
    let repromptText = '';
    const sessionAttributes = {};

   
    
     
        console.log("\n\nLoading handler\n\n");

        var params = {
            TableName: "DYNAMODB_TABLE_EXPENSES",
            ProjectionExpression: "#pr, incDesc, userId,incStatus, id",
            FilterExpression: "#pr = :priority and #st = :incidentStatus",
            ExpressionAttributeNames: {
                "#pr": "priority",
                "#st": "incStatus"
            },
            ExpressionAttributeValues: {
                 ":priority": "high",
                 ":incidentStatus": "open" 
            }
        };
       // const data = await dynamoDb.scan(params);
      let incidents = "";
      try{
        incidents = await dynamoDb.scan(params).promise();
         console.log("Scan succeeded.");
                  incidents.Items.forEach(function(incident) {
                     console.log(" description -- "+
                          incident.incDesc + ": ",
                          incident.priority, "- assigned to:", incident.userId
                          , "- id:", incident.id);
                          //speechOutput += requestAttributes.t('READ_INCIDENT_MESSAGE', incident.incDesc, incident.userId, incident.incStatus);
                  });
                  if(typeof(incidents) != "undefined" && typeof(incidents.Items) != "undefined"  && incidents.Items.length > 0)
                  {
                         speechOutput += requestAttributes.t('READ_INCIDENT_MESSAGE', incidents.Items[0].incDesc, incidents.Items[0].userId,
                         incidents.Items[0].incStatus);
                          Object.assign(sessionAttributes, {
                            incidentId:  incidents.Items[0].id
                          });
                        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                  }                         
                  else
                          speechOutput += requestAttributes.t('NO_HIGH_OPEN_MESSAGE');
                  
                    return responseBuilder.speak(speechOutput)
                           .reprompt(repromptText)
                           .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
                           .getResponse();
        
      }catch(err)
      {
          console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
          speechOutput += requestAttributes.t('READ_FAILED_MESSAGE');
          return responseBuilder.speak(speechOutput)
          .reprompt(repromptText)
          .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
          .getResponse();
      }
  }
  
  async function handleUpdate(handlerInput) {
    const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
    const { intent } = requestEnvelope.request;
    const requestAttributes = attributesManager.getRequestAttributes();
    const sessionAttributes = attributesManager.getSessionAttributes();
     var reqStatus = intent.slots.status.value;
    let speechOutput = '';
    let repromptText = '';
    let savedIncidentId = sessionAttributes.incidentId;

    console.log("\n\nLoading handler\n\n ,,, "+ savedIncidentId);
      if(typeof(savedIncidentId) != "undefined") {
           var params = {
            TableName: "DYNAMODB_TABLE_EXPENSES",
            Key : {
              "id" : savedIncidentId
            },
            UpdateExpression: "set incStatus = :r",
            ExpressionAttributeValues: {
                 ":r": reqStatus
            },
            ReturnValues:"UPDATED_NEW"
        };
        
     console.log("Updating the item...");
       // const data = await dynamoDb.scan(params);
      let updatestatus = "";
      try{
        updatestatus = await dynamoDb.update(params).promise();
        console.log(" status ==> "+ JSON.stringify(updatestatus));
        console.log("update succeeded.");
        speechOutput += requestAttributes.t('UPDATE_INCIDENT_SUCCESS', reqStatus);
         handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
         return responseBuilder.speak(speechOutput)
                           .reprompt(repromptText)
                           .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
                           .getResponse();
        
      }catch(err)
      {
          console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
          speechOutput += requestAttributes.t('UPDATE_INCIDENT_FAILED');
          return responseBuilder.speak(speechOutput)
          .reprompt(repromptText)
          .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
          .getResponse();
      }
      }
        speechOutput += requestAttributes.t('UPDATE_INCIDENT_FAILED');
          return responseBuilder.speak(speechOutput)
          .reprompt(repromptText)
          .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
          .getResponse();
       
  }

function startGame(newGame, handlerInput) {
  
  const options = {
            host: 'ec2-3-81-14-128.compute-1.amazonaws.com',
            path: '/job/SampleXML/build',
            port: 80,
            method: 'POST'
        };
        var req = http.request(options, function (res) {
            var responseString = "";
        
            res.on("data", function (data) {
                responseString += data;
                // save all the data from response
                console.log('response '+ JSON.stringify(responseString));
            });
            res.on("end", function () {
                console.log(responseString); 
                // print to console when response ends
            });
        });
        req.write('');
        req.end();
  
  
  
  
  
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  let speechOutput = newGame
    ? requestAttributes.t('NEW_GAME_MESSAGE', requestAttributes.t('GAME_NAME'))
      + requestAttributes.t('WELCOME_MESSAGE', GAME_LENGTH.toString())
    : '';
  const translatedQuestions = requestAttributes.t('QUESTIONS');
  const gameQuestions = populateGameQuestions(translatedQuestions);
  const correctAnswerIndex = Math.floor(Math.random() * (ANSWER_COUNT));

  const roundAnswers = populateRoundAnswers(
    gameQuestions,
    0,
    correctAnswerIndex,
    translatedQuestions
  );
  const currentQuestionIndex = 0;
  const spokenQuestion = Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0];
  let repromptText = requestAttributes.t('TELL_QUESTION_MESSAGE');
 /* requestAttributes.t()
  for (let i = 0; i < ANSWER_COUNT; i += 1) {
    repromptText += `${i + 1}. ${roundAnswers[i]}. `;
  }*/

  speechOutput += repromptText;
  const sessionAttributes = {};

  const translatedQuestion = translatedQuestions[gameQuestions[currentQuestionIndex]];

  Object.assign(sessionAttributes, {
    speechOutput: repromptText,
    repromptText,
    currentQuestionIndex,
    correctAnswerIndex: correctAnswerIndex + 1,
    questions: gameQuestions,
    score: 0,
    correctAnswerText: translatedQuestion[Object.keys(translatedQuestion)[0]][0]
  });

  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

  return handlerInput.responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
    .getResponse();
}

function helpTheUser(newGame, handlerInput) {
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  const askMessage = newGame
    ? requestAttributes.t('ASK_MESSAGE_START')
    : requestAttributes.t('REPEAT_QUESTION_MESSAGE') + requestAttributes.t('STOP_MESSAGE');
  const speechOutput = requestAttributes.t('HELP_MESSAGE', GAME_LENGTH) + askMessage;
  const repromptText = requestAttributes.t('HELP_REPROMPT') + askMessage;

  return handlerInput.responseBuilder.speak(speechOutput).reprompt(repromptText).getResponse();
}

/* jshint -W101 */
const languageString = {
  en: {
    translation: {
      QUESTIONS: questions.QUESTIONS_EN_US,
      GAME_NAME: 'Reindeer Trivia',
      HELP_MESSAGE: 'I will ask you %s multiple choice questions. Respond with the number of the answer. For example, say one, two, three, or four. To start a new game at any time, say, start game. ',
      REPEAT_QUESTION_MESSAGE: 'To repeat the last question, say, repeat. ',
      ASK_MESSAGE_START: 'Would you like to start playing?',
      HELP_REPROMPT: 'To give an answer to a question, respond with the number of the answer. ',
      STOP_MESSAGE: 'Would you like to keep playing?',
      CANCEL_MESSAGE: 'Ok, let\'s play again soon.',
      NO_MESSAGE: 'Ok, we\'ll play another time. Goodbye!',
      TRIVIA_UNHANDLED: 'Try saying a number between 1 and %s',
      HELP_UNHANDLED: 'Say yes to continue, or no to end the game.',
      START_UNHANDLED: 'Say start to start a new game.',
      NEW_GAME_MESSAGE: 'Welcome to Incident Hub. ',
      WELCOME_MESSAGE: 'What you want to do.. create incident or read incidents.',
      ANSWER_CORRECT_MESSAGE: 'correct. ',
      ANSWER_WRONG_MESSAGE: 'wrong. ',
      CORRECT_ANSWER_MESSAGE: 'The correct answer is %s: %s. ',
      ANSWER_IS_MESSAGE: 'Sorry failed to save incident for %s ',
      ADDED_INCIDENT_MESSAGE: 'Incident is raised successfully for %s',
      READ_INCIDENT_MESSAGE: 'There is one open High Priority incident. Incident says %s, It is assigned to %s',
      NO_HIGH_OPEN_MESSAGE : 'Good News !! There are no high priority incidents which are in open status..',
      READ_FAILED_MESSAGE: 'failed to open Incidents',
      TELL_QUESTION_MESSAGE: '',
      GAME_OVER_MESSAGE: 'You got %s out of %s questions correct. Thank you for playing!',
      SCORE_IS_MESSAGE: 'Your score is %s. ',
      WHAT_NEXT_MESSAGE: 'Anything else i could do. ',
      UPDATE_INCIDENT_SUCCESS : "Incident status has been updated successfully to %s.",
      UPDATE_INCIDENT_FAILED : "I am sorry, Incident status update failed"
    },
  },
  'en-US': {
    translation: {
      QUESTIONS: questions.QUESTIONS_EN_US,
      GAME_NAME: 'Incident Hub'
    },
  },
  'en-GB': {
    translation: {
      QUESTIONS: questions.QUESTIONS_EN_GB,
      GAME_NAME: 'Incident Board',
      ADDED_INCIDENT_MESSAGE: 'Incident is raised successfully for %s'
    },
  },
  de: {
    translation: {
      QUESTIONS: questions.QUESTIONS_DE_DE,
      GAME_NAME: 'Wissenswertes über Rentiere in Deutsch',
      HELP_MESSAGE: 'Ich stelle dir %s Multiple-Choice-Fragen. Antworte mit der Zahl, die zur richtigen Antwort gehört. Sage beispielsweise eins, zwei, drei oder vier. Du kannst jederzeit ein neues Spiel beginnen, sage einfach „Spiel starten“. ',
      REPEAT_QUESTION_MESSAGE: 'Wenn die letzte Frage wiederholt werden soll, sage „Wiederholen“ ',
      ASK_MESSAGE_START: 'Möchten Sie beginnen?',
      HELP_REPROMPT: 'Wenn du eine Frage beantworten willst, antworte mit der Zahl, die zur richtigen Antwort gehört. ',
      STOP_MESSAGE: 'Möchtest du weiterspielen?',
      CANCEL_MESSAGE: 'OK, dann lass uns bald mal wieder spielen.',
      NO_MESSAGE: 'OK, spielen wir ein andermal. Auf Wiedersehen!',
      TRIVIA_UNHANDLED: 'Sagt eine Zahl beispielsweise zwischen 1 und %s',
      HELP_UNHANDLED: 'Sage ja, um fortzufahren, oder nein, um das Spiel zu beenden.',
      START_UNHANDLED: 'Du kannst jederzeit ein neues Spiel beginnen, sage einfach „Spiel starten“.',
      NEW_GAME_MESSAGE: 'Willkommen bei %s. ',
      WELCOME_MESSAGE: 'Ich stelle dir %s Fragen und du versuchst, so viele wie möglich richtig zu beantworten. Sage einfach die Zahl, die zur richtigen Antwort passt. Fangen wir an. ',
      ANSWER_CORRECT_MESSAGE: 'Richtig. ',
      ANSWER_WRONG_MESSAGE: 'Falsch. ',
      CORRECT_ANSWER_MESSAGE: 'Die richtige Antwort ist %s: %s. ',
      ANSWER_IS_MESSAGE: 'Diese Antwort ist ',
      TELL_QUESTION_MESSAGE: 'What you want to do create incident or read incidents',
      GAME_OVER_MESSAGE: 'Du hast %s von %s richtig beantwortet. Danke fürs Mitspielen!',
      SCORE_IS_MESSAGE: 'Dein Ergebnis ist %s. ',
      ADDED_INCIDENT_MESSAGE: 'Incident is raised successfully for %s',
      READ_INCIDENT_MESSAGE: 'Opened Incident and its description is %s'
    },
  },
};


const LocalizationInterceptor = {
  process(handlerInput) {
    const localizationClient = i18n.use(sprintf).init({
      lng: handlerInput.requestEnvelope.request.locale,
      overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
      resources: languageString,
      returnObjects: true
    });

    const attributes = handlerInput.attributesManager.getRequestAttributes();
    attributes.t = function (...args) {
      return localizationClient.t(...args);
    };
  },
};

const LaunchRequest = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    return request.type === 'LaunchRequest'
      || (request.type === 'IntentRequest'
        && request.intent.name === 'AMAZON.StartOverIntent');
  },
  handle(handlerInput) {
    return startGame(true, handlerInput);
  },
};


const HelpIntent = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    const newGame = !(sessionAttributes.questions);
    return helpTheUser(newGame, handlerInput);
  },
};

const UnhandledIntent = {
  canHandle() {
    return true;
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    if (Object.keys(sessionAttributes).length === 0) {
      const speechOutput = requestAttributes.t('START_UNHANDLED');
      return handlerInput.attributesManager
        .speak(speechOutput)
        .reprompt(speechOutput)
        .getResponse();
    } else if (sessionAttributes.questions) {
      const speechOutput = requestAttributes.t('TRIVIA_UNHANDLED', ANSWER_COUNT.toString());
      return handlerInput.attributesManager
        .speak(speechOutput)
        .reprompt(speechOutput)
        .getResponse();
    }
    const speechOutput = requestAttributes.t('HELP_UNHANDLED');
    return handlerInput.attributesManager.speak(speechOutput).reprompt(speechOutput).getResponse();
  },
};

const SessionEndedRequest = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const AnswerIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && (handlerInput.requestEnvelope.request.intent.name === 'AnswerIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'DontKnowIntent');
  },
  handle(handlerInput) {
    if (handlerInput.requestEnvelope.request.intent.name === 'AnswerIntent') {
      return handleUserGuess(false, handlerInput);
    }
    return handleUserGuess(true, handlerInput);
  },
};

const CreateIntent = {
    canHandle(handlerInput) {
      return handlerInput.requestEnvelope.request.type === 'IntentRequest'
          && (handlerInput.requestEnvelope.request.intent.name === 'CreateIntent'
        );
    },
    handle(handlerInput) {
      return handleCreate(handlerInput);
    },
  };

  const ReadIncidentIntent = {
    canHandle(handlerInput) {
      return handlerInput.requestEnvelope.request.type === 'IntentRequest'
          && (handlerInput.requestEnvelope.request.intent.name === 'ReadIncidentIntent'
        );
    },
    handle(handlerInput) {
      return handleRead(handlerInput);
    },
  };
  
  const UpdateIncidentIntent = {
    canHandle(handlerInput) {
      return handlerInput.requestEnvelope.request.type === 'IntentRequest'
          && (handlerInput.requestEnvelope.request.intent.name === 'UpdateIncidentIntent'
        );
    },
    handle(handlerInput) {
      return handleUpdate(handlerInput);
    },
  };

const RepeatIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.RepeatIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    return handlerInput.responseBuilder.speak(sessionAttributes.speechOutput)
      .reprompt(sessionAttributes.repromptText)
      .getResponse();
  },
};

const YesIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.YesIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    if (sessionAttributes.questions) {
      return handlerInput.responseBuilder.speak(sessionAttributes.speechOutput)
        .reprompt(sessionAttributes.repromptText)
        .getResponse();
    }
    return startGame(false, handlerInput);
  },
};


const StopIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speechOutput = requestAttributes.t('STOP_MESSAGE');

    return handlerInput.responseBuilder.speak(speechOutput)
      .reprompt(speechOutput)
      .getResponse();
  },
};

const CancelIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speechOutput = requestAttributes.t('CANCEL_MESSAGE');

    return handlerInput.responseBuilder.speak(speechOutput)
      .getResponse();
  },
};

const NoIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NoIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speechOutput = requestAttributes.t('NO_MESSAGE');
    return handlerInput.responseBuilder.speak(speechOutput).getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Sorry, I can\'t understand the command. Please say again.')
      .reprompt('Sorry, I can\'t understand the command. Please say again.')
      .getResponse();
  },
};

const skillBuilder = Alexa.SkillBuilders.custom();
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequest,
    CreateIntent,
    ReadIncidentIntent,
    UpdateIncidentIntent,
    HelpIntent,
    AnswerIntent,
    RepeatIntent,
    YesIntent,
    StopIntent,
    CancelIntent,
    NoIntent,
    SessionEndedRequest,
    UnhandledIntent
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .lambda();