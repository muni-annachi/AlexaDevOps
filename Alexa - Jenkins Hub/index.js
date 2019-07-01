/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');
const recipes = require('./recipes');
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');
const http = require('http');

/* INTENT HANDLERS */
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    const item = requestAttributes.t(getRandomItem(Object.keys(recipes.RECIPE_EN_US)));
  
    const speakOutput = requestAttributes.t('WELCOME_MESSAGE');
    const repromptOutput = requestAttributes.t('WELCOME_REPROMPT');
    
    /*const options = {
            host: 'ec2-3-91-240-54.compute-1.amazonaws.com',
            path: '/job/Payment/build?token=Pb9uy2o2ZXj4MhB1lB25',
            auth: 'auto:auto',
            port: 8080,
            method: 'POST'
        };*/
   /*     var response = '';
        try{
           response = await runJob(handlerInput); 
            console.log("run job response "+ response);
            speakOutput = requestAttributes.t('JOB_SUCCESS');
              return handlerInput.responseBuilder
              .speak(speakOutput)
              .reprompt(repromptOutput)
              .getResponse();
        }catch(err){
             return handlerInput.responseBuilder
              .speak(speakOutput)
              .reprompt(repromptOutput)
              .getResponse();
        }
     
   */
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(repromptOutput)
      .getResponse();
  },
};

const StartJob = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'RunJobIntent';
  },
   handle(handlerInput) {
    return runJob(handlerInput);
  },
};

const StatusofJob = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'JobStatusIntent';
  },
   handle(handlerInput) {
    return getJobStatus(handlerInput);
  },
};

async function runJob(handlerInput){
   const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
     let jobname = handlerInput.requestEnvelope.request.intent.slots.jobname;
      let speakOutput = requestAttributes.t('JOB_SUCCESS');
    const repromptOutput = requestAttributes.t('WELCOME_REPROMPT');
     console.log(" Entered intent ... " + jobname.value);
    let responseString = '';
    if (jobname && jobname.value) {
        let jobPath = '/job/'+jobname.value+'/build';
       const options = {
            host: 'ec2-3-91-240-54.compute-1.amazonaws.com',
            path: jobPath,
            port: 8080,
            method: 'POST'
        };
        
         try {
        let res = await callJenkins(options);
        console.log('resposne frmo jenkins '+ JSON.stringify(res));
          speakOutput = requestAttributes.t('JOB_SUCCESS');
        } catch (err) {
          console.log('some error occurred...' + JSON.stringify(err));
        }
        
    }
        // speakOutput = requestAttributes.t('JOB_SUCCESS');
              return handlerInput.responseBuilder
              .speak(speakOutput)
              .reprompt(repromptOutput)
              .getResponse();
          
}

async function getJobStatus(handlerInput){
   const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
     let jobname = handlerInput.requestEnvelope.request.intent.slots.jobname;
      let speakOutput = '';
    const repromptOutput = requestAttributes.t('WELCOME_REPROMPT');
     console.log(" Entered intent status ... " + jobname.value);
    let responseString = '';
    if (jobname && jobname.value) {
        let options = 'http://ec2-3-91-240-54.compute-1.amazonaws.com:8080/job/'+jobname.value+'/lastBuild/api/json?tree=result,timestamp,estimatedDuration,number,building,duration';
                try {
        let res = await getStatus(options);
        console.log('resposne frmo jenkins '+ JSON.stringify(res));
        if(res)
        {
          if(res.building)
            speakOutput = requestAttributes.t('JOB_RUNNING');
          
          else if(res.result && res.result === 'SUCCESS' )
           speakOutput = requestAttributes.t('JOB_RUN_SUCCESS', res.number);
          else
          
          speakOutput = requestAttributes.t('JOB_RUN_FAILED', res.number);
            
        }
        } catch (err) {
          console.log('some error occurred...' + JSON.stringify(err));
        }
        
    }
        // speakOutput = requestAttributes.t('JOB_SUCCESS');
              return handlerInput.responseBuilder
              .speak(speakOutput)
              .reprompt(repromptOutput)
              .getResponse();
          
}

function callJenkins(options) {
  return new Promise ((resolve, reject) => {
    let req = http.request(options);
    req.on('response', res => {
      resolve(res);
    });

    req.on('error', err => {
      reject(err);
    });
    req.write('');
    req.end();
  }); 
}

function getStatus(options) {
  return new Promise ((resolve, reject) => {
  http.get(options, (res) => {
  const { statusCode } = res;
  const contentType = res.headers['content-type'];

  let error;
  if (statusCode !== 200) {
    error = new Error('Request Failed.\n' +
                      `Status Code: ${statusCode}`);
  } else if (!/^application\/json/.test(contentType)) {
    error = new Error('Invalid content-type.\n' +
                      `Expected application/json but received ${contentType}`);
  }
  if (error) {
    console.error(error.message);
    // consume response data to free up memory
    res.resume();
    return;
  }

  res.setEncoding('utf8');
  let rawData = '';
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(rawData);
      console.log(parsedData);
       resolve(parsedData);
    } catch (e) {
      console.error(e.message);
    }
  });
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
   reject(e);
});
}); 

  /*return new Promise ((resolve, reject) => {
    let req = http.get(options);
    req.on('response', res => {
      resolve(res);
    });

    req.on('error', err => {
      reject(err);
    });
  }); */
}

const RecipeHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'RecipeIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    const itemSlot = handlerInput.requestEnvelope.request.intent.slots.Item;
    let itemName;
    if (itemSlot && itemSlot.value) {
      itemName = itemSlot.value.toLowerCase();
    }

    const cardTitle = requestAttributes.t('DISPLAY_CARD_TITLE', requestAttributes.t('SKILL_NAME'), itemName);
    const myRecipes = requestAttributes.t('RECIPES');
    const recipe = myRecipes[itemName];
    let speakOutput = "";

    if (recipe) {
      sessionAttributes.speakOutput = recipe;
      //sessionAttributes.repromptSpeech = requestAttributes.t('RECIPE_REPEAT_MESSAGE');
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

      return handlerInput.responseBuilder
        .speak(sessionAttributes.speakOutput) // .reprompt(sessionAttributes.repromptSpeech)
        .withSimpleCard(cardTitle, recipe)
        .getResponse();
    }
    else{
      speakOutput = requestAttributes.t('RECIPE_NOT_FOUND_MESSAGE');
      const repromptSpeech = requestAttributes.t('RECIPE_NOT_FOUND_REPROMPT');
      if (itemName) {
        speakOutput += requestAttributes.t('RECIPE_NOT_FOUND_WITH_ITEM_NAME', itemName);
      } else {
        speakOutput += requestAttributes.t('RECIPE_NOT_FOUND_WITHOUT_ITEM_NAME');
      }
      speakOutput += repromptSpeech;

      sessionAttributes.speakOutput = speakOutput; //saving speakOutput to attributes, so we can use it to repeat
      sessionAttributes.repromptSpeech = repromptSpeech;

      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

      return handlerInput.responseBuilder
        .speak(sessionAttributes.speakOutput)
        .reprompt(sessionAttributes.repromptSpeech)
        .getResponse();
    }
  }
};

const HelpHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    const item = requestAttributes.t(getRandomItem(Object.keys(recipes.RECIPE_EN_US)));

    sessionAttributes.speakOutput = requestAttributes.t('HELP_MESSAGE', item);
    sessionAttributes.repromptSpeech = requestAttributes.t('HELP_REPROMPT', item);

    return handlerInput.responseBuilder
      .speak(sessionAttributes.speakOutput)
      .reprompt(sessionAttributes.repromptSpeech)
      .getResponse();
  },
};

const RepeatHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.RepeatIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    return handlerInput.responseBuilder
      .speak(sessionAttributes.speakOutput)
      .reprompt(sessionAttributes.repromptSpeech)
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent');
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speakOutput = requestAttributes.t('STOP_MESSAGE', requestAttributes.t('SKILL_NAME'));

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    console.log("Inside SessionEndedRequestHandler");
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${JSON.stringify(handlerInput.requestEnvelope)}`);
    return handlerInput.responseBuilder.getResponse();
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

/* CONSTANTS */
const skillBuilder = Alexa.SkillBuilders.standard();
const languageStrings = {
  en: {
    translation: {
      RECIPES: recipes.RECIPE_EN_US,
      SKILL_NAME: 'Minecraft Helper',
      WELCOME_MESSAGE: 'Hello, I am your Jenkins Pal, What can i do for u ? Run a Job or check status of a job?',
      JOB_SUCCESS: 'Job started successfully',
      JOB_RUNNING: 'Job is currently in progress',
      JOB_RUN_SUCCESS: 'Job ran successfully for build number %s',
      JOB_RUN_FAILED: 'Job failed for build number %s',
      WELCOME_REPROMPT: 'What can i do for u ? Run a Job or check status of a job?',
      DISPLAY_CARD_TITLE: '%s  - Recipe for %s.',
      HELP_MESSAGE: 'You can ask questions such as, what\'s the recipe for a %s, or, you can say exit...Now, what can I help you with?',
      HELP_REPROMPT: 'You can say things like, what\'s the recipe for a %s, or you can say exit...Now, what can I help you with?',
      STOP_MESSAGE: 'Goodbye!',
      RECIPE_REPEAT_MESSAGE: 'Try saying repeat.',
      RECIPE_NOT_FOUND_MESSAGE: 'I\'m sorry, I currently do not know ',
      RECIPE_NOT_FOUND_WITH_ITEM_NAME: 'the recipe for %s. ',
      RECIPE_NOT_FOUND_WITHOUT_ITEM_NAME: 'that recipe. ',
      RECIPE_NOT_FOUND_REPROMPT: 'What else can I help with?'
    },
  },
  'en-US': {
    translation: {
      RECIPES: recipes.RECIPE_EN_US,
      SKILL_NAME: 'American Minecraft Helper'
    },
  },
  'en-GB': {
    translation: {
      RECIPES: recipes.RECIPE_EN_GB,
      SKILL_NAME: 'British Minecraft Helper'
    },
  },
  de: {
    translation: {
      RECIPES: recipes.RECIPE_DE_DE,
      SKILL_NAME: 'Assistent für Minecraft in Deutsch',
      WELCOME_MESSAGE: 'Willkommen bei %s. Du kannst beispielsweise die Frage stellen: Welche Rezepte gibt es für eine %s? ... Nun, womit kann ich dir helfen?',
      WELCOME_REPROMPT: 'Wenn du wissen möchtest, was du sagen kannst, sag einfach „Hilf mir“.',
      DISPLAY_CARD_TITLE: '%s - Rezept für %s.',
      HELP_MESSAGE: 'Du kannst beispielsweise Fragen stellen wie „Wie geht das Rezept für eine %s“ oder du kannst „Beenden“ sagen ... Wie kann ich dir helfen?',
      HELP_REPROMPT: 'Du kannst beispielsweise Sachen sagen wie „Wie geht das Rezept für eine %s“ oder du kannst „Beenden“ sagen ... Wie kann ich dir helfen?',
      STOP_MESSAGE: 'Auf Wiedersehen!',
      RECIPE_REPEAT_MESSAGE: 'Sage einfach „Wiederholen“.',
      RECIPE_NOT_FOUND_MESSAGE: 'Tut mir leid, ich kenne derzeit ',
      RECIPE_NOT_FOUND_WITH_ITEM_NAME: 'das Rezept für %s nicht. ',
      RECIPE_NOT_FOUND_WITHOUT_ITEM_NAME: 'dieses Rezept nicht. ',
      RECIPE_NOT_FOUND_REPROMPT: 'Womit kann ich dir sonst helfen?'
    },
  },
};

// Finding the locale of the user
const LocalizationInterceptor = {
  process(handlerInput) {
    const localizationClient = i18n.use(sprintf).init({
      lng: handlerInput.requestEnvelope.request.locale,
      overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
      resources: languageStrings,
      returnObjects: true
    });

    const attributes = handlerInput.attributesManager.getRequestAttributes();
    attributes.t = function (...args) {
      return localizationClient.t(...args);
    };
  },
};

// getRandomItem
function getRandomItem(arrayOfItems) {
  // the argument is an array [] of words or phrases
  let i = 0;
  i = Math.floor(Math.random() * arrayOfItems.length);
  return (arrayOfItems[i]);
};

/* LAMBDA SETUP */
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    StartJob,
    StatusofJob,
    RecipeHandler,
    HelpHandler,
    RepeatHandler,
    ExitHandler,
    SessionEndedRequestHandler
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .lambda();
