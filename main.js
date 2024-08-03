const { app, BrowserWindow, ipcMain, Menu, globalShortcut, shell } = require('electron');
const path = require('path');
const express = require('express');
const { google } = require('googleapis');
const open = require('open');
const fs = require('fs');
const axios = require('axios');

require('electron-reload')(__dirname, {
  electron: require(`${__dirname}/node_modules/electron`)
});

console.log("Electron app module loaded: ", !!app);

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/tasks.readonly'];
const TOKEN_PATH = 'token.json';

const client_id = '721718670827-tgovpmanoh9lft4e5rpnvdm3nqu9ufcs.apps.googleusercontent.com';
const client_secret = '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';
const redirect_uri = 'http://localhost:8000/oauth2callback';

let mainWindow;
let displayWindows = {};
let server;
let oAuth2Client;
let isLoggedIn;
let cachedEvents = [];
let availableCalendars = [];
let selectedCalendars = [];
let cachedTasks = [];



const fetchAllCalendars = async (auth) => {
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const calendarList = await calendar.calendarList.list();
    availableCalendars = calendarList.data.items;
    selectedCalendars = availableCalendars; // Default to all calendars selected
    // console.log('Fetched calendars:', availableCalendars);

    if (displayWindows['cal1-display']) {
      displayWindows['cal1-display'].webContents.send('available-calendars', availableCalendars, selectedCalendars.map(cal => cal.id));
    }
    if (displayWindows['cal2-display']) {
      displayWindows['cal2-display'].webContents.send('available-calendars', availableCalendars, selectedCalendars.map(cal => cal.id));
    }
    if (displayWindows['cal3-display']) {
      displayWindows['cal3-display'].webContents.send('available-calendars', availableCalendars, selectedCalendars.map(cal => cal.id));
    }
    if (displayWindows['cal4-display']) {
      displayWindows['cal4-display'].webContents.send('available-calendars', availableCalendars, selectedCalendars.map(cal => cal.id));
    }
  } catch (error) {
    console.error('Error fetching calendars:', error);
  }
};


const fetchSelectedEvents = async (auth) => {
  clearEvents();
  const calendar = google.calendar({ version: 'v3', auth });
  let allEvents = [];

  try {
    console.log('Fetching selected events...');
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 3);
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 3);

    for (const cal of selectedCalendars) {
      let pageToken = null;
      do {
        const eventsRes = await calendar.events.list({
          calendarId: cal.id,
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          pageToken: pageToken,
        });

        eventsRes.data.items.forEach(event => {
          const start = event.start.dateTime || event.start.date;
          const end = event.end.dateTime || event.end.date;
          const time = event.start.dateTime ? `${new Date(start).toLocaleTimeString()} - ${new Date(end).toLocaleTimeString()}` : 'All Day';
          // console.log(`\nCalendar Name: ${cal.summary}\nDate: ${new Date(start).toLocaleDateString()}\nName: ${event.summary}\nTime: ${time}\n`);
        });

        allEvents = allEvents.concat(eventsRes.data.items);
        pageToken = eventsRes.data.nextPageToken;
      } while (pageToken);
    }

    // console.log('Fetched selected events:', allEvents);
    cachedEvents = allEvents;
    checkAndSendEvents();
  } catch (error) {
    console.error('Error fetching events:', error);
  }
};







const fetchTasks = async (auth) => {
  const tasks = google.tasks({ version: 'v1', auth });
  let allTasks = [];

  try {
    const taskLists = await tasks.tasklists.list();
    for (const taskList of taskLists.data.items) {
      const tasksRes = await tasks.tasks.list({
        tasklist: taskList.id,
      });

      allTasks = allTasks.concat(tasksRes.data.items);
    }

    cachedTasks = allTasks;

    if (displayWindows['todo1']) {
      sendTasksToTodo1();
    }

    if (displayWindows['todo2']) {
      sendTasksToTodo2();
    }

    if (displayWindows['todo3']) {
      sendWeeklyTasksToTodo3();
    }
    if (displayWindows['todo4']) {
      sendWeeklyTasksToTodo4();
    }
    if (displayWindows['todo5']) {
      sendWeeklyTasksToTodo5();
    }

  } catch (error) {
    console.error('Error fetching tasks:', error);
  }
};


const sendTasksToTodo1 = () => {
  if (displayWindows['todo1']) {
    displayWindows['todo1'].webContents.send('clear-tasks');
    cachedTasks.forEach(task => {
      // console.log('Sending task:', task);
      displayWindows['todo1'].webContents.send('task', {
        id: task.id,
        title: task.title,
        notes: task.notes,
        due: task.due,
        status: task.status
      });
    });
  }
};


const sendTasksToTodo2 = () => {
  if (displayWindows['todo2']) {
    displayWindows['todo2'].webContents.send('clear-tasks');
    cachedTasks.forEach(task => {
      // console.log('Sending task:', task);
      displayWindows['todo2'].webContents.send('task', {
        id: task.id,
        title: task.title,
        notes: task.notes,
        due: task.due,
        status: task.status
      });
    });
  }
};



const sendWeeklyTasksToTodo3 = () => {
  if (displayWindows['todo3']) {
    const today = new Date();
    const start = new Date(today.setDate(today.getDate() - today.getDay())); // Start of the week (Sunday)
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // End of the week (Saturday)

    const weeklyTasks = cachedTasks.filter(task => {
      const taskDate = new Date(task.due);
      const taskDateUTC = new Date(Date.UTC(taskDate.getUTCFullYear(), taskDate.getUTCMonth(), taskDate.getUTCDate()));
      return taskDateUTC >= start && taskDateUTC <= end;
    });

    displayWindows['todo3'].webContents.send('clear-tasks');
    weeklyTasks.forEach(task => {
      displayWindows['todo3'].webContents.send('task', {
        id: task.id,
        title: task.title,
        notes: task.notes,
        due: task.due,
        status: task.status
      });
    });
  }
};


const sendWeeklyTasksToTodo4 = () => {
  if (displayWindows['todo4']) {
    const today = new Date();
    const start = new Date(today.setDate(today.getDate() - today.getDay())); // Start of the week (Sunday)
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // End of the week (Saturday)

    const weeklyTasks = cachedTasks.filter(task => {
      const taskDate = new Date(task.due);
      const taskDateUTC = new Date(Date.UTC(taskDate.getUTCFullYear(), taskDate.getUTCMonth(), taskDate.getUTCDate()));
      return taskDateUTC >= start && taskDateUTC <= end;
    });

    displayWindows['todo4'].webContents.send('clear-tasks');
    weeklyTasks.forEach(task => {
      displayWindows['todo4'].webContents.send('task', {
        id: task.id,
        title: task.title,
        notes: task.notes,
        due: task.due,
        status: task.status
      });
    });
  }
};


const sendWeeklyTasksToTodo5 = () => {
  if (displayWindows['todo5']) {
    const today = new Date();
    const start = new Date(today.setDate(today.getDate() - today.getDay())); // Start of the week (Sunday)
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // End of the week (Saturday)

    const weeklyTasks = cachedTasks.filter(task => {
      const taskDate = new Date(task.due);
      const taskDateUTC = new Date(Date.UTC(taskDate.getUTCFullYear(), taskDate.getUTCMonth(), taskDate.getUTCDate()));
      return taskDateUTC >= start && taskDateUTC <= end;
    });

    displayWindows['todo5'].webContents.send('clear-tasks');
    weeklyTasks.forEach(task => {
      displayWindows['todo5'].webContents.send('task', {
        id: task.id,
        title: task.title,
        notes: task.notes,
        due: task.due,
        status: task.status
      });
    });
  }
};





ipcMain.on('get-calendars', (event) => {
  fetchAllCalendars(oAuth2Client);
});

ipcMain.on('set-selected-calendars', (event, calendarIds) => {
  selectedCalendars = availableCalendars.filter(cal => calendarIds.includes(cal.id));
  fetchSelectedEvents(oAuth2Client);
});

ipcMain.on('request-tasks', async (event, date) => {
  // console.log(`Tasks requested for date: ${date}`);
  await fetchTasks(oAuth2Client);
  const filteredTasks = cachedTasks.filter(task => {
    const taskDate = new Date(task.due);
    const taskDateUTC = new Date(Date.UTC(taskDate.getUTCFullYear(), taskDate.getUTCMonth(), taskDate.getUTCDate()));
    const requestedDateUTC = new Date(date);
    requestedDateUTC.setUTCHours(0, 0, 0, 0); // Normalize to start of the day in UTC
    return taskDateUTC.getTime() === requestedDateUTC.getTime();
  });
  // console.log(`Sending filtered tasks: ${JSON.stringify(filteredTasks)}`);
  event.sender.send('tasks-list', filteredTasks);
});


ipcMain.on('request-weekly-tasks', async (event, startDate) => {
  console.log(`Received request-weekly-tasks for date: ${startDate}`);

  await fetchTasks(oAuth2Client);
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(start.getDate() + 6); // Set the end date to 6 days after the start date

  const filteredTasks = cachedTasks.filter(task => {
    const taskDate = new Date(task.due);
    const taskDateUTC = new Date(Date.UTC(taskDate.getUTCFullYear(), taskDate.getUTCMonth(), taskDate.getUTCDate()));
    return taskDateUTC >= start && taskDateUTC <= end;
  });

  console.log('Sending filtered tasks:', filteredTasks);
  event.sender.send('tasks-list', filteredTasks);
});



const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1422 + 16,
    height: 800 + 65,
    minWidth: 646 + 16,
    minHeight: 363 + 65,
    useContentSize: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'src/logo.png'),
  });
  mainWindow.loadFile('html/my-widdy.html');
  // Menu.setApplicationMenu(null);


  mainWindow.once('ready-to-show', () => {
    const contentWidth = 1422;
    const contentHeight = 800;

    const frameSize = mainWindow.getSize();
    const contentSize = mainWindow.getContentSize();

    console.log('Initial frame size:', frameSize);
    console.log('Initial content size:', contentSize);

    const widthAdjustment = frameSize[0] - contentSize[0];
    const heightAdjustment = frameSize[1] - contentSize[1];

    console.log('Width adjustment:', widthAdjustment);
    console.log('Height adjustment:', heightAdjustment);

    // Adjust window size only if needed
    if (widthAdjustment !== 0 || heightAdjustment !== 0) {
      mainWindow.setSize(contentWidth + widthAdjustment, contentHeight + heightAdjustment);
    }

    const newFrameSize = mainWindow.getSize();
    const newContentSize = mainWindow.getContentSize();

    console.log('New frame size:', newFrameSize);
    console.log('New content size:', newContentSize);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://mail.google.com/')) {
      shell.openExternal(url);
    } else if (url.startsWith('mailto:')) {
      const email = url.substring(7);
      const mailtoUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${email}`;
      shell.openExternal(mailtoUrl);
    } else {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
};







// const createDisplayWindow = (id, title, width, height) => {
//   console.log(`Toggling window: ${id}`);
//   if (displayWindows[id]) {
//     displayWindows[id].close();
//     delete displayWindows[id];
//   } else {
//     displayWindows[id] = new BrowserWindow({
//       width: parseInt(width),
//       height: parseInt(height),
//       title: title,
//       frame: false,
//       transparent: true,
//       resizable: true,
//       webPreferences: {
//         nodeIntegration: true,
//         contextIsolation: false,
//         autoplayPolicy: 'no-user-gesture-required'
//       },
//       icon: path.join(__dirname, 'src/logo.png'),
//     });

//     displayWindows[id].loadFile(path.join(__dirname, `html/${id}.html`)).then(() => {
//       console.log(`${id} window loaded`);
//       if (['cal1-display', 'cal2-display', 'cal3-display', 'cal4-display'].includes(id)) {
//         if (isLoggedIn) {
//           sendEventsToCals();
//         }
//       } else if (id === 'todo1') {
//         if (isLoggedIn) {
//           sendTasksToTodo1();
//         }
//       }
//     }).catch((err) => {
//       console.error(`Failed to load ${id} window:`, err);
//     });

//     displayWindows[id].on('closed', () => {
//       delete displayWindows[id];
//     });
//   }
// };


const createDisplayWindow = (id, title, width, height) => {
  console.log(`Toggling window: ${id}`);
  if (displayWindows[id]) {
    displayWindows[id].close();
    delete displayWindows[id];
  } else {
    displayWindows[id] = new BrowserWindow({
      width: parseInt(width),
      height: parseInt(height),
      title: title,
      frame: false,
      transparent: true,
      resizable: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        // autoplayPolicy: 'no-user-gesture-required'
      },
      icon: path.join(__dirname, 'src/logo.png'),
    });

    displayWindows[id].loadFile(path.join(__dirname, `html/${id}.html`)).then(() => {
      console.log(`${id} window loaded`);
      // Add additional initialization logic here if needed
    }).catch((err) => {
      console.error(`Failed to load ${id} window:`, err);
    });

    displayWindows[id].on('closed', () => {
      delete displayWindows[id];
    });
  }
};


function openClock1Display() {
  if (!displayWindows['clock1-display']) {
    createDisplayWindow('clock1-display', 'Clock1 Display', 800, 300);
  } else {
    displayWindows['clock1-display'].show();
  }
}

function closeClock1Display() {
  if (displayWindows['clock1-display']) {
    displayWindows['clock1-display'].hide();
  }
}

ipcMain.on('clock1-status', (event, data) => {
  if (data.id === 'clock1-display' && data.status) {
    openClock1Display();
  } else if (data.id === 'clock1-display' && !data.status) {
    closeClock1Display();
  }
});

ipcMain.on('adjust-clock-size', (event, { id, size }) => {
  if (id === 'clock1-display' && displayWindows[id]) {
    const newSize = parseInt(size);
    const newWidth = (newSize / 50) * 800; // Maintain aspect ratio
    const newHeight = (newSize / 50) * 300;
    displayWindows[id].setSize(Math.round(newWidth), Math.round(newHeight));
    displayWindows[id].webContents.send('resize-clock', { newWidth, newHeight });
  }
});



// app.on('ready', openClock1Display);




function openClock2Display() {
  if (!displayWindows['clock2-display']) {
    createDisplayWindow('clock2-display', 'Clock2 Display', 800, 300);
  } else {
    displayWindows['clock2-display'].show();
  }
}

function closeClock2Display() {
  if (displayWindows['clock2-display']) {
    displayWindows['clock2-display'].hide();
  }
}

ipcMain.on('clock2-status', (event, data) => {
  if (data.id === 'clock2-display' && data.status) {
    openClock2Display();
  } else if (data.id === 'clock2-display' && !data.status) {
    closeClock2Display();
  }
});

ipcMain.on('adjust-clock-size', (event, { id, size }) => {
  if (id === 'clock2-display' && displayWindows[id]) {
    const newSize = parseInt(size);
    const newWidth = (newSize / 50) * 800; // Maintain aspect ratio
    const newHeight = (newSize / 50) * 300;
    displayWindows[id].setSize(Math.round(newWidth), Math.round(newHeight));
    displayWindows[id].webContents.send('resize-clock', { newWidth, newHeight });
  }
});

ipcMain.on('change-clock2-color', (event, colorSet) => {
  if (displayWindows['clock2-display']) {
    displayWindows['clock2-display'].webContents.send('change-clock2-color', colorSet);
  }
});

// app.on('ready', openClock2Display);



function openClock3Display() {
  if (!displayWindows['clock3-display']) {
    createDisplayWindow('clock3-display', 'Clock3 Display', 800, 300);
  } else {
    displayWindows['clock3-display'].show();
  }
}

function closeClock3Display() {
  if (displayWindows['clock3-display']) {
    displayWindows['clock3-display'].hide();
  }
}

ipcMain.on('clock3-status', (event, data) => {
  if (data.id === 'clock3-display' && data.status) {
    openClock3Display();
  } else if (data.id === 'clock3-display' && !data.status) {
    closeClock3Display();
  }
});


function openClock4Display() {
  if (!displayWindows['clock4-display']) {
    createDisplayWindow('clock4-display', 'Clock4 Display', 800, 400);
  } else {
    displayWindows['clock4-display'].show();
  }
}

function closeClock4Display() {
  if (displayWindows['clock4-display']) {
    displayWindows['clock4-display'].hide();
  }
}

ipcMain.on('clock4-status', (event, data) => {
  if (data.id === 'clock4-display' && data.status) {
    openClock4Display();
  } else if (data.id === 'clock4-display' && !data.status) {
    closeClock4Display();
  }
});



function openClock5Display() {
  if (!displayWindows['clock5-display']) {
    createDisplayWindow('clock5-display', 'Clock5 Display', 800, 500);
  } else {
    displayWindows['clock5-display'].show();
  }
}

function closeClock5Display() {
  if (displayWindows['clock5-display']) {
    displayWindows['clock5-display'].hide();
  }
}

ipcMain.on('clock5-status', (event, data) => {
  if (data.id === 'clock5-display' && data.status) {
    openClock5Display();
  } else if (data.id === 'clock5-display' && !data.status) {
    closeClock5Display();
  }
});


function openClock6Display() {
  if (!displayWindows['clock6-display']) {
    createDisplayWindow('clock6-display', 'Clock6 Display', 800, 600);
  } else {
    displayWindows['clock6-display'].show();
  }
}

function closeClock6Display() {
  if (displayWindows['clock6-display']) {
    displayWindows['clock6-display'].hide();
  }
}

ipcMain.on('clock6-status', (event, data) => {
  if (data.id === 'clock6-display' && data.status) {
    openClock6Display();
  } else if (data.id === 'clock6-display' && !data.status) {
    closeClock6Display();
  }
});








const toggleClockDisplay = (id, status, height, width) => {
  if (status) {
    createDisplayWindow(id, 'Clock Display', width, height);
  } else {
    if (displayWindows[id]) {
      displayWindows[id].close();
      delete displayWindows[id];
    }
  }
};

const authorize = (callback) => {
  fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    const credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getAccessToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      isLoggedIn = true;
      callback(oAuth2Client);
      mainWindow.webContents.send('auth-status', 'linked');
      fetchAllEvents(oAuth2Client);
      fetchTasks(oAuth2Client);
    });
  });
};

const getAccessToken = (oAuth2Client, callback) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  open(authUrl);

  const app = express();
  server = app.listen(8000, () => {
    console.log('Server is listening on port 8000');
  });

  app.get('/oauth2callback', (req, res) => {
    const code = req.query.code;
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      res.send('Authentication successful! You can close this window.');
      isLoggedIn = true;
      callback(oAuth2Client);
      mainWindow.webContents.send('auth-status', 'linked');
      server.close(() => {
        console.log('Server closed');
      });
      fetchAllEvents(oAuth2Client);
      fetchTasks(oAuth2Client);
    });
  });
};





const fetchAllEvents = async (auth) => {
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    console.log('Fetching all events...');
    const calendarList = await calendar.calendarList.list();
    let allEvents = [];

    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 3);
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 3);

    for (const cal of calendarList.data.items) {
      let pageToken = null;
      do {
        const eventsRes = await calendar.events.list({
          calendarId: cal.id,
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          pageToken: pageToken,
        });

        eventsRes.data.items.forEach(event => {
          const start = event.start.dateTime || event.start.date;
          const end = event.end.dateTime || event.end.date;
          const time = event.start.dateTime ? `${new Date(start).toLocaleTimeString()} - ${new Date(end).toLocaleTimeString()}` : 'All Day';
          console.log(`\nCalendar Name: ${cal.summary}\nDate: ${new Date(start).toLocaleDateString()}\nName: ${event.summary}\nTime: ${time}\n`);
        });

        allEvents = allEvents.concat(eventsRes.data.items);
        pageToken = eventsRes.data.nextPageToken;
      } while (pageToken);
    }

    console.log('Fetched all events:', allEvents);
    cachedEvents = allEvents;
    if (displayWindows['cal1-display']) {
      sendEventsToCals();
    }
    if (displayWindows['cal2-display']) {
      sendEventsToCals();
    }
    if (displayWindows['cal3-display']) {
      sendEventsToCals();
    }
    if (displayWindows['cal4-display']) {
      sendEventsToCals();
    }
  } catch (error) {
    console.error('Error fetching events:', error);
  }
};



const checkAndSendEvents = () => {
  const calDisplayIds = ['cal1-display', 'cal2-display', 'cal3-display', 'cal4-display'];
  let anyDisplayOpen = false;
  calDisplayIds.forEach(displayId => {
    if (displayWindows[displayId]) {
      anyDisplayOpen = true;
    }
  });
  if (anyDisplayOpen) {
    sendEventsToCals();
  }
};

const sendEventsToCals = () => {
  if (displayWindows['cal1-display']) {
    cachedEvents.forEach(event => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;

      let meetingLink = null;
      if (event.conferenceData && event.conferenceData.entryPoints && event.conferenceData.entryPoints.length > 0) {
        meetingLink = event.conferenceData.entryPoints[0].uri;
      }
      // console.log(`Event: ${event.summary}, Meeting Link: ${meetingLink}`);
      displayWindows['cal1-display'].webContents.send('event', {
        date: start,
        summary: event.summary,
        description: event.description,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        allDay: !event.start.dateTime,
        meetingLink: meetingLink
      });
    });
  }
  if (displayWindows['cal2-display']) {
    cachedEvents.forEach(event => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;

      let meetingLink = null;
      if (event.conferenceData && event.conferenceData.entryPoints && event.conferenceData.entryPoints.length > 0) {
        meetingLink = event.conferenceData.entryPoints[0].uri;
      }
      // console.log(`Event: ${event.summary}, Meeting Link: ${meetingLink}`);
      displayWindows['cal2-display'].webContents.send('event', {
        date: start,
        summary: event.summary,
        description: event.description,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        allDay: !event.start.dateTime,
        meetingLink: meetingLink
      });
    });
  }
  if (displayWindows['cal3-display']) {
    cachedEvents.forEach(event => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;

      let meetingLink = null;
      if (event.conferenceData && event.conferenceData.entryPoints && event.conferenceData.entryPoints.length > 0) {
        meetingLink = event.conferenceData.entryPoints[0].uri;
      }
      // console.log(`Event: ${event.summary}, Meeting Link: ${meetingLink}`);
      displayWindows['cal3-display'].webContents.send('event', {
        date: start,
        summary: event.summary,
        description: event.description,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        allDay: !event.start.dateTime,
        meetingLink: meetingLink
      });
    });
  }
  if (displayWindows['cal4-display']) {
    cachedEvents.forEach(event => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;

      let meetingLink = null;
      if (event.conferenceData && event.conferenceData.entryPoints && event.conferenceData.entryPoints.length > 0) {
        meetingLink = event.conferenceData.entryPoints[0].uri;
      }
      // console.log(`Event: ${event.summary}, Meeting Link: ${meetingLink}`);
      displayWindows['cal4-display'].webContents.send('event', {
        date: start,
        summary: event.summary,
        description: event.description,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        allDay: !event.start.dateTime,
        meetingLink: meetingLink
      });
    });
  }

};



const clearEvents = () => {
  cachedEvents = [];
  if (displayWindows['cal1-display']) {
    displayWindows['cal1-display'].webContents.send('clear-events');
  }
  if (displayWindows['cal2-display']) {
    displayWindows['cal2-display'].webContents.send('clear-events');
  }
  if (displayWindows['cal3-display']) {
    displayWindows['cal3-display'].webContents.send('clear-events');
  }
  if (displayWindows['cal4-display']) {
    displayWindows['cal4-display'].webContents.send('clear-events');
  }

};


app.on('ready', () => {
  createMainWindow();

  // Register a 'CommandOrControl+R' shortcut listener that reloads the window
  globalShortcut.register('CommandOrControl+R', () => {
    if (mainWindow) {
      mainWindow.reload();
    }
  });

  const server = express();
  server.get('/auth', (req, res) => {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/drive&access_type=offline&include_granted_scopes=true&response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}`;
    res.redirect(authUrl);
  });

  server.get('/oauth2callback', async (req, res) => {
    const auth_code = req.query.code;
    try {
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', null, {
        params: {
          code: auth_code,
          client_id: client_id,
          client_secret: client_secret,
          redirect_uri: redirect_uri,
          grant_type: 'authorization_code',
        },
      });
      const { access_token, refresh_token } = tokenResponse.data;
      res.send(`Access Token: ${access_token}<br>Refresh Token: ${refresh_token}`);
    } catch (error) {
      res.send('Error exchanging authorization code for tokens');
    }
  });

  server.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
  });
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


// app.on('ready', createMainWindow);
// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') {
//     app.quit();
//   }
// });


app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});


// function createDisplayWindow(id, title, width, height) {
//   console.log(`Toggling window: ${id}`);
//   if (displayWindows[id]) {
//     displayWindows[id].close();
//     delete displayWindows[id];
//   } else {
//     displayWindows[id] = new BrowserWindow({
//       width: parseInt(width),
//       height: parseInt(height),
//       title: title,
//       frame: false,
//       transparent: true,
//       resizable: true,
//       webPreferences: {
//         nodeIntegration: true,
//         contextIsolation: false,
//         autoplayPolicy: 'no-user-gesture-required' // Add this setting

//       },
//       icon: path.join(__dirname, 'src/logo.png'),
//     });

//     displayWindows[id].loadFile(path.join(__dirname, `html/${id}.html`)).then(() => {
//       console.log(`${id} window loaded`);
//       if (['cal1-display', 'cal2-display', 'cal3-display', 'cal4-display'].includes(id)) {
//         if (isLoggedIn) {
//           sendEventsToCals();
//         }
//       } else if (id === 'todo1') {
//         if (isLoggedIn) {
//           sendTasksToTodo1();
//         }
//       }
//     }).catch((err) => {
//       console.error(`Failed to load ${id} window:`, err);
//     });

//     displayWindows[id].on('closed', () => {
//       delete displayWindows[id];
//     });
//   }
// }

ipcMain.on('auth-google', () => {
  authorize(() => {
    console.log('Authorized successfully');
  });
});

ipcMain.on('logout-google', () => {
  fs.unlink(TOKEN_PATH, (err) => {
    if (err) return console.error(err);
    console.log('Token removed');
    isLoggedIn = false;
    mainWindow.webContents.send('auth-status', 'unlinked');
    clearEvents();
  });
});

ipcMain.on('check-auth-status', () => {
  fs.readFile(TOKEN_PATH, (err) => {
    if (err) {
      mainWindow.webContents.send('auth-status', 'unlinked');
      isLoggedIn = false;
    } else {
      mainWindow.webContents.send('auth-status', 'linked');
      isLoggedIn = true;
      authorize(() => { });
    }
  });
});

ipcMain.on('toggle-display', (event, { id, status, height, width }) => {
  toggleClockDisplay(id, status, height, width);
});





ipcMain.on('adjust-clock-size', (event, { id, size }) => {
  if (displayWindows[id]) {
    const newSize = parseInt(size);
    const newWidth = (newSize / 50) * 800;
    const newHeight = (newSize / 50) * 300;
    displayWindows[id].setSize(Math.round(newWidth), Math.round(newHeight));
    displayWindows[id].webContents.send('resize-clock', { newWidth, newHeight });
  }
});





ipcMain.on('adjust-cal1-size', (event, { size }) => {
  if (displayWindows['cal1-display']) {
    const newSize = parseInt(size);
    const newWidth = (newSize / 50) * 900;
    const newHeight = (newSize / 50) * 453;
    displayWindows['cal1-display'].setSize(Math.round(newWidth), Math.round(newHeight));
    displayWindows['cal1-display'].webContents.send('resize-cal1', { newWidth, newHeight });
  }
});


ipcMain.on('adjust-cal2-size', (event, { size }) => {
  if (displayWindows['cal2-display']) {
    const newSize = parseInt(size);
    const newWidth = (newSize / 50) * 645;
    const newHeight = (newSize / 50) * 380;
    displayWindows['cal2-display'].setSize(Math.round(newWidth), Math.round(newHeight));
    displayWindows['cal2-display'].webContents.send('resize-cal2', { newWidth, newHeight });
    console.log(`Resized cal2-display to width: ${newWidth}, height: ${newHeight}`);
  }
});


ipcMain.on('adjust-cal3-size', (event, { size }) => {
  if (displayWindows['cal3-display']) {
    const newSize = parseInt(size);
    const newWidth = (newSize / 50) * 1000;
    const newHeight = (newSize / 50) * 453;
    displayWindows['cal3-display'].setSize(Math.round(newWidth), Math.round(newHeight));
    displayWindows['cal3-display'].webContents.send('resize-cal3', { newWidth, newHeight });
    console.log(`Resized cal3-display to width: ${newWidth}, height: ${newHeight}`);
  }
});


ipcMain.on('adjust-cal4-size', (event, { size }) => {
  if (displayWindows['cal4-display']) {
    const newSize = parseInt(size);
    const newWidth = (newSize / 50) * 450;
    const newHeight = (newSize / 50) * 700;
    displayWindows['cal4-display'].setSize(Math.round(newWidth), Math.round(newHeight));
    displayWindows['cal4-display'].webContents.send('resize-cal4', { newWidth, newHeight });
    console.log(`Resized cal4-display to width: ${newWidth}, height: ${newHeight}`);
  }
});


ipcMain.on('adjust-todo1-size', (event, { size }) => {
  if (displayWindows['todo1-display']) {
    const newSize = parseInt(size);
    const newWidth = (newSize / 50) * 300;
    const newHeight = (newSize / 50) * 450;
    displayWindows['todo1-display'].setSize(Math.round(newWidth), Math.round(newHeight));
    displayWindows['todo1-display'].webContents.send('resize-todo1', { newWidth, newHeight });
    console.log(`Resized todo1-display to width: ${newWidth}, height: ${newHeight}`);
  }
});


ipcMain.on('adjust-todo2-size', (event, { size }) => {
  if (displayWindows['todo2-display']) {
    const newSize = parseInt(size);
    const newWidth = (newSize / 50) * 300;
    const newHeight = (newSize / 50) * 450;
    displayWindows['todo2-display'].setSize(Math.round(newWidth), Math.round(newHeight));
    displayWindows['todo2-display'].webContents.send('resize-todo2', { newWidth, newHeight });
    console.log(`Resized todo2-display to width: ${newWidth}, height: ${newHeight}`);
  }
});

ipcMain.on('adjust-todo3-size', (event, { size }) => {
  if (displayWindows['todo3-display']) {
    const newSize = parseInt(size);
    const newWidth = (newSize / 50) * 1400;
    const newHeight = (newSize / 50) * 450;
    displayWindows['todo3-display'].setSize(Math.round(newWidth), Math.round(newHeight));
    displayWindows['todo3-display'].webContents.send('resize-todo3', { newWidth, newHeight });
    console.log(`Resized todo3-display to width: ${newWidth}, height: ${newHeight}`);
  }
});

ipcMain.on('adjust-todo4-size', (event, { size }) => {
  if (displayWindows['todo4-display']) {
    const newSize = parseInt(size);
    const newWidth = (newSize / 50) * 1400;
    const newHeight = (newSize / 50) * 450;
    displayWindows['todo4-display'].setSize(Math.round(newWidth), Math.round(newHeight));
    displayWindows['todo4-display'].webContents.send('resize-todo4', { newWidth, newHeight });
    console.log(`Resized todo4-display to width: ${newWidth}, height: ${newHeight}`);
  }
});



ipcMain.on('adjust-todo5-size', (event, { size }) => {
  if (displayWindows['todo5-display']) {
    const newSize = parseInt(size);
    const newWidth = (newSize / 50) * 1400;
    const newHeight = (newSize / 50) * 450;
    displayWindows['todo5-display'].setSize(Math.round(newWidth), Math.round(newHeight));
    displayWindows['todo5-display'].webContents.send('resize-todo5', { newWidth, newHeight });
    console.log(`Resized todo5-display to width: ${newWidth}, height: ${newHeight}`);
  }
});







ipcMain.on('change-clock1-color', (event, colorSet) => {
  if (displayWindows['clock1-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['clock1-display'].webContents.send('change-clock1-color', colorSet);
  }
});

ipcMain.on('change-clock2-color', (event, colorSet) => {
  if (displayWindows['clock2-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['clock2-display'].webContents.send('change-clock2-color', colorSet);
  }
});

ipcMain.on('change-clock3-color', (event, colorSet) => {
  if (displayWindows['clock3-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['clock3-display'].webContents.send('change-clock3-color', colorSet);
  }
});

ipcMain.on('change-clock4-color', (event, colorSet) => {
  if (displayWindows['clock4-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['clock4-display'].webContents.send('change-clock4-color', colorSet);
  }
});

ipcMain.on('change-clock5-color', (event, colorSet) => {
  if (displayWindows['clock5-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['clock5-display'].webContents.send('change-clock5-color', colorSet);
  }
});

ipcMain.on('change-clock6-color', (event, colorSet) => {
  if (displayWindows['clock6-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['clock6-display'].webContents.send('change-clock6-color', colorSet);
  }
});


ipcMain.on('set-clock-format', (event, { id, format }) => {
  if (displayWindows[id]) {
    displayWindows[id].webContents.send('set-clock-format', { format });
    console.log(`Setting format for ${id} to ${format}`);
  }
});


// ipcMain.on('set-clock-format', (event, { format }) => {
//   console.log(`Received set-clock-format with format: ${format}`);
//   if (displayWindows['clock1-display']) {
//     displayWindows['clock1-display'].webContents.send('set-clock-format', { format });
//   }
//   if (displayWindows['clock2-display']) {
//     displayWindows['clock2-display'].webContents.send('set-clock-format', { format });
//   }
//   if (displayWindows['clock3-display']) {
//     displayWindows['clock3-display'].webContents.send('set-clock-format', { format });
//   }
//   if (displayWindows['clock4-display']) {
//     displayWindows['clock4-display'].webContents.send('set-clock-format', { format });
//   }
//   if (displayWindows['clock5-display']) {
//     displayWindows['clock5-display'].webContents.send('set-clock-format', { format });
//   }
//   if (displayWindows['clock6-display']) {
//     displayWindows['clock6-display'].webContents.send('set-clock-format', { format });
//   }

// });




ipcMain.on('change-cal1-color', (event, colorSet) => {
  if (displayWindows['cal1-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['cal1-display'].webContents.send('change-cal1-color', colorSet);
  }
});

ipcMain.on('change-cal2-color', (event, colorSet) => {
  if (displayWindows['cal2-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['cal2-display'].webContents.send('change-cal2-color', colorSet);
  }
});

ipcMain.on('change-cal3-color', (event, colorSet) => {
  if (displayWindows['cal3-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['cal3-display'].webContents.send('change-cal3-color', colorSet);
  }
});

ipcMain.on('change-cal4-color', (event, colorSet) => {
  if (displayWindows['cal4-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['cal4-display'].webContents.send('change-cal4-color', colorSet);
  }
});




ipcMain.on('change-clock2-color', (event, colorSet) => {
  if (displayWindows['clock2-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['clock2-display'].webContents.send('change-clock2-color', colorSet);
  }
});

ipcMain.on('change-clock3-color', (event, colorSet) => {
  if (displayWindows['clock3-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['clock3-display'].webContents.send('change-clock3-color', colorSet);
  }
});

ipcMain.on('change-clock4-color', (event, colorSet) => {
  if (displayWindows['clock4-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['clock4-display'].webContents.send('change-clock4-color', colorSet);
  }
});



// ipcMain.on('change-todo1-color', (event, colorSet) => {
//   if (displayWindows['todo1']) {
//     displayWindows['todo1'].webContents.send('change-todo1-color', colorSet);
//   } else if (displayWindows['display4']) {
//     displayWindows['display4'].webContents.send('change-todo1-color', colorSet);
//   }
// });


ipcMain.on('change-todo1-color', (event, colorSet) => {
  if (displayWindows['todo1-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['todo1-display'].webContents.send('change-todo1-color', colorSet);
  }
});


ipcMain.on('change-todo2-color', (event, colorSet) => {
  if (displayWindows['todo2-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['todo2-display'].webContents.send('change-todo2-color', colorSet);
  }
});


ipcMain.on('change-todo3-color', (event, colorSet) => {
  if (displayWindows['todo3-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['todo3-display'].webContents.send('change-todo3-color', colorSet);
  }
});


ipcMain.on('change-todo4-color', (event, colorSet) => {
  if (displayWindows['todo4-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['todo4-display'].webContents.send('change-todo4-color', colorSet);
  }
});




ipcMain.on('change-todo5-color', (event, colorSet) => {
  if (displayWindows['todo5-display']) {
    console.log(`Changing clock color to: ${colorSet}`);
    displayWindows['todo5-display'].webContents.send('change-todo5-color', colorSet);
  }
});



ipcMain.on('change-weather-color', (event, colorSet) => {
  if (displayWindows['display5']) {
    displayWindows['display5'].webContents.send('change-weather-color', colorSet);
  } else if (displayWindows['display6']) {
    displayWindows['display6'].webContents.send('change-weather-color', colorSet);
  }
});



function openCal1Display() {
  if (!displayWindows['cal1-display']) {
    createDisplayWindow('cal1-display', 'Cal1 Display', 900, 453);
  }
}

function closeCal1Display() {
  if (displayWindows['cal1-display']) {
    displayWindows['cal1-display'].close();
  }
}

function openCal2Display() {
  if (!displayWindows['cal2-display']) {
    createDisplayWindow('cal2-display', 'Cal2 Display', 645, 380);
  }
}

function closeCal2Display() {
  if (displayWindows['cal2-display']) {
    displayWindows['cal2-display'].close();
  }
}


function openCal3Display() {
  if (!displayWindows['cal3-display']) {
    createDisplayWindow('cal3-display', 'Cal3 Display', 1000, 453);
  }
}

function closeCal3Display() {
  if (displayWindows['cal3-display']) {
    displayWindows['cal3-display'].close();
  }
}


function openCal4Display() {
  if (!displayWindows['cal4-display']) {
    createDisplayWindow('cal4-display', 'Cal4 Display', 450, 700);
  }
}

function closeCal4Display() {
  if (displayWindows['cal4-display']) {
    displayWindows['cal4-display'].close();
  }
}


function openTodo1Display() {
  if (!displayWindows['todo1-display']) {
    createDisplayWindow('todo1-display', 'Todo1 Display', 300, 450);
  }
}

function closeTodo1Display() {
  if (displayWindows['todo1-display']) {
    displayWindows['todo1-display'].close();
  }
}



function openTodo2Display() {
  if (!displayWindows['todo2-display']) {
    createDisplayWindow('todo2-display', 'Todo2 Display', 300, 450);
  }
}

function closeTodo2Display() {
  if (displayWindows['todo2-display']) {
    displayWindows['todo2-display'].close();
  }
}



function openTodo3Display() {
  if (!displayWindows['todo3-display']) {
    createDisplayWindow('todo3-display', 'Todo3 Display', 1400, 450);
  }
}

function closeTodo3Display() {
  if (displayWindows['todo3-display']) {
    displayWindows['todo3-display'].close();
  }
}



function openTodo4Display() {
  if (!displayWindows['todo4-display']) {
    createDisplayWindow('todo4-display', 'Todo4 Display', 1400, 450);
  }
}

function closeTodo4Display() {
  if (displayWindows['todo4-display']) {
    displayWindows['todo4-display'].close();
  }
}



function openTodo5Display() {
  if (!displayWindows['todo5-display']) {
    createDisplayWindow('todo5-display', 'Todo5 Display', 1400, 450);
  }
}

function closeTodo5Display() {
  if (displayWindows['todo5-display']) {
    displayWindows['todo5-display'].close();
  }
}



function openWea1Display() {
  if (!displayWindows['wea1-display']) {
    createDisplayWindow('wea1-display', 'Wea1 Display', 1400, 450);
  }
}

function closeWea1Display() {
  if (displayWindows['wea1-display']) {
    displayWindows['wea1-display'].close();
  }
}








ipcMain.on('open-cal1-display', () => {
  openCal1Display();
});

ipcMain.on('close-cal1-display', () => {
  closeCal1Display();
});

ipcMain.on('open-cal2-display', () => {
  openCal2Display();
});

ipcMain.on('close-cal2-display', () => {
  closeCal2Display();
});

ipcMain.on('open-cal3-display', () => {
  openCal3Display();
});

ipcMain.on('close-cal3-display', () => {
  closeCal3Display();
});


ipcMain.on('open-cal4-display', () => {
  openCal4Display();
});

ipcMain.on('close-cal4-display', () => {
  closeCal4Display();
});


ipcMain.on('open-todo1-display', () => {
  openTodo1Display();
});

ipcMain.on('close-todo1-display', () => {
  closeTodo1Display();
});



ipcMain.on('open-todo2-display', () => {
  openTodo2Display();
});

ipcMain.on('close-todo2-display', () => {
  closeTodo2Display();
});




ipcMain.on('open-todo3-display', () => {
  openTodo3Display();
});

ipcMain.on('close-todo3-display', () => {
  closeTodo3Display();
});


ipcMain.on('open-todo4-display', () => {
  openTodo4Display();
});

ipcMain.on('close-todo4-display', () => {
  closeTodo4Display();
});



ipcMain.on('open-todo5-display', () => {
  openTodo5Display();
});

ipcMain.on('close-todo5-display', () => {
  closeTodo5Display();
});



ipcMain.on('open-wea1-display', () => {
  openWea1Display();
});

ipcMain.on('close-wea1-display', () => {
  closeWea1Display();
});





ipcMain.on('cal1-status', (event, arg) => {
  if (arg.status) {
    openCal1Display();
  } else {
    closeCal1Display();
  }
});

ipcMain.on('cal2-status', (event, arg) => {
  if (arg.status) {
    openCal2Display();
  } else {
    closeCal2Display();
  }
});

ipcMain.on('cal3-status', (event, arg) => {
  if (arg.status) {
    openCal3Display();
  } else {
    closeCal3Display();
  }
});


ipcMain.on('cal4-status', (event, arg) => {
  if (arg.status) {
    openCal4Display();
  } else {
    closeCal4Display();
  }
});


ipcMain.on('todo1-status', (event, arg) => {
  if (arg.status) {
    openTodo1Display();
  } else {
    closeTodo1Display();
  }
});


ipcMain.on('todo2-status', (event, arg) => {
  if (arg.status) {
    openTodo2Display();
  } else {
    closeTodo2Display();
  }
});


ipcMain.on('todo3-status', (event, arg) => {
  if (arg.status) {
    openTodo3Display();
  } else {
    closeTodo3Display();
  }
});

ipcMain.on('todo4-status', (event, arg) => {
  if (arg.status) {
    openTodo4Display();
  } else {
    closeTodo4Display();
  }
});

ipcMain.on('todo5-status', (event, arg) => {
  if (arg.status) {
    openTodo5Display();
  } else {
    closeTodo5Display();
  }
});



ipcMain.on('wea1-status', (event, arg) => {
  if (arg.status) {
    openWea1Display();
  } else {
    closeWea1Display();
  }
});





// let clock1Window;

// function openClock1Display() {
//   if (!clock1Window) {
//     clock1Window = new BrowserWindow({
//       width: 800,
//       height: 300,
//       frame: false,
//       transparent: true,
//       alwaysOnTop: true,
//       webPreferences: {
//         nodeIntegration: true,
//         contextIsolation: false,
//       },
//     });

//     clock1Window.loadFile('html/clock1-display.html');

//     clock1Window.on('closed', () => {
//       clock1Window = null;
//     });
//   } else {
//     clock1Window.show();
//   }
// }

// ipcMain.on('clock1-status', (event, data) => {
//   if (data.id === 'clock1-display' && data.status) {
//     openClock1Display();
//   } else if (data.id === 'clock1-display' && !data.status) {
//     if (clock1Window) {
//       clock1Window.hide();
//     }
//   }
// });

// ipcMain.on('adjust-clock-size', (event, { id, size }) => {
//   if (id === 'clock1-display' && clock1Window) {
//     const newSize = parseInt(size);
//     const newWidth = (newSize / 50) * 800; // Maintain aspect ratio
//     const newHeight = (newSize / 50) * 300;
//     clock1Window.setSize(Math.round(newWidth), Math.round(newHeight));
//     clock1Window.webContents.send('resize-clock', { newWidth, newHeight });
//   }
// });

// app.on('ready', openClock1Display);


ipcMain.handle('get-weather', async (event, city, unit) => {
  const apiKey = '6461774d1ed46f31edb9cf271eb2477b'; // Replace with your OpenWeather API key
  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=${unit}`);
    const { coord } = response.data;

    const response_air = await axios.get(`http://api.openweathermap.org/data/2.5/air_pollution?lat=${coord.lat}&lon=${coord.lon}&appid=${apiKey}`);
    const response_fivedays = await axios.get(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=${unit}`);

    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const filteredForecast = response_fivedays.data.list.filter(forecast => {
      const forecastTime = new Date(forecast.dt * 1000);
      return forecastTime >= now && forecastTime <= next24h;
    });

    const weatherData = { weather: response.data, air: response_air.data, forecast: filteredForecast };

    return weatherData;
  } catch (error) {
    return { error: error.message };
  }
});


app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


