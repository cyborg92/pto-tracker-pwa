(function() {
    'use strict';

    var app = {
        isLoading: true,
        vapidKeys: null,
        userDetails: {
            id: "abhishekpandey7@deloitte.com",
            name: "Abhishek Pandey",
            teams: [
                "pwa",
                "at&t"
            ]
        },
        team: '',
        teamDetails: {},
        daysOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        endpoints: {
            teams: 'teams',
            vapid: 'vapid',
            notification: 'notification',
            pto: 'pto'
        },
        tableData: {
            title: '',
            isBootstrapped: false,
            header: {
                elements: [{
                    iconPath: ''
                }]
            },
            body: {
                elements: []
            }
        },
        subscription: null,
        homscreenBtn: document.getElementById('homscreen-btn'),
        deferredPrompt: null

    };

    /*****************************************************************************
     *
     * Util methods
     *
     ****************************************************************************/

    app.getUrl = function(endpoint) {
        return new URL('https://polar-tundra-94573.herokuapp.com/' + endpoint);
    }

    app.urlBase64ToUint8Array = function(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    app.getDateString = function(day, activeDay) {
        let calDate = new Date(new Date().getTime() + ((day - activeDay) * 24 * 60 * 60 * 1000));
        return calDate.getDate() + '-' + calDate.getMonth() + '-' + calDate.getFullYear();
    }

    app.isDateActive = function(ptoList, day, activeDay) {
        const dateString = app.getDateString(day, activeDay);
        return (ptoList.indexOf(dateString) > -1) ? true : false;
    }

    app.generateNotification = function(event) {
        if (app.subscription) {
            event = JSON.parse(event);
            let payload = event.memberName + ' marked ' + (event.action ? 'unavailable' : 'available') + ' on ' + event.date;
            const delay = 5;
            const ttl = 0;
            const notificationsUrl = app.getUrl(app.endpoints.notification);
            fetch(notificationsUrl, {
                method: 'post',
                headers: {
                    'Content-type': 'application/json',
                },
                body: JSON.stringify({
                    subscription: app.subscription,
                    payload: payload,
                    delay: delay,
                    ttl: ttl,
                }),
            });
        } else {
            console.error('Push subscription missing');
        }

    };

    /*****************************************************************************
     *
     * Methods for dealing with the model
     *
     ****************************************************************************/

    app.team = app.userDetails.teams[0];

    app.getTeamDetails = async function() {
        let teamUrl = app.getUrl(app.endpoints.teams);
        teamUrl.search = new URLSearchParams({ id: app.team });
        if ('caches' in window) {
            caches.match(teamUrl).then(function(response) {
                if (response) {
                    response.json().then(function updateFromCache(json) {
                        [app.teamDetails] = json;
                        app.setTableData();
                        app.updateSidebar();
                        app.teamAvailability();
                    });
                }
            });
        }
        // Fetch the latest data.
        let request = new XMLHttpRequest();
        request.onreadystatechange = function() {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    let [teamResponseJson] = JSON.parse(request.response);
                    if (app.teamDetails.hasOwnProperty('lastUpdated') && (new Date(app.teamDetails.lastUpdated).getTime() > new Date(teamResponseJson.lastUpdated).getTime())) {
                        return;
                    }
                    app.teamDetails = teamResponseJson;
                    app.setTableData();
                    app.updateSidebar();
                    app.teamAvailability();

                }

            } else {
                console.log('entered else block');
                let responseJson = app.getMockObj();
                app.teamDetails = responseJson;
                app.setTableData();
                app.updateSidebar();
                app.teamAvailability();
            }
        };
        request.open('GET', teamUrl);
        request.send();

    }

    app.getVapidKeys = async function() {
        try {
            let vapidUrl = app.getUrl(app.endpoints.vapid);
            let vapidResponse = await fetch(vapidUrl);
            app.vapidKeys = await vapidResponse.text();
        } catch (e) {
            console.error(e);
        }
    }

    /*****************************************************************************
     *
     * Event listeners for UI elements
     *
     ****************************************************************************/

    app.checkBoxChange = function(event) {
        let checkBoxData = JSON.parse(event.target.dataset.value);
        const payload = JSON.stringify({
            teamId: checkBoxData.teamId,
            memberId: checkBoxData.memberId,
            memberName: checkBoxData.memberName,
            date: app.getDateString(checkBoxData.currentIndex, checkBoxData.activeIndex),
            action: event.target.checked
        });
        const ptoURL = app.getUrl(app.endpoints.pto);
        fetch(ptoURL, {
                method: 'post',
                headers: {
                    'Content-type': 'application/json'
                },
                body: payload,
            })
            .then(async(res) => {
                let ptoResponse = await res.json();
                if (ptoResponse && ptoResponse.hasOwnProperty('data') && ptoResponse.data === 'success')
                    app.generateNotification(payload);
                app.updateTeamDetails();
            })
            .catch((err) => console.error('PTO Request failed', err));
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        app.deferredPrompt = e;
    });

    app.homscreenBtn.addEventListener('click', (e) => {
        console.log('clicked');
        // Show the prompt
        app.deferredPrompt.prompt();
        // // Wait for the user to respond to the prompt
        app.deferredPrompt.userChoice
            .then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the A2HS prompt');
                } else {
                    console.log('User dismissed the A2HS prompt');
                }
                app.deferredPrompt = null;
            });
    });

    /*****************************************************************************
     *
     * Methods to update/refresh the UI
     *
     ****************************************************************************/
    app.setTableData = function() {
        const now = new Date();
        const today = now.getDay();
        let tableElement = document.getElementById('pto-table');
        tableElement.removeAttribute('hidden');
        if (app.tableData.isBootstrapped) {
            app.tableData = {
                title: '',
                isBootstrapped: false,
                header: {
                    elements: [{
                        iconPath: ''
                    }]
                },
                body: {
                    elements: []
                }
            }
            tableElement.deleteTHead();
            let tBodyEl = tableElement.querySelector('tbody');
            tBodyEl.parentNode.removeChild(tBodyEl);
        };
        app.tableData.title = app.team,
            app.daysOfWeek.forEach((day, index) => {
                app.tableData.header.elements.push({
                    day: day.substring(0, 3),
                    dateIndex: index,
                    active: (app.daysOfWeek[today] === day)
                })
            });
        app.teamDetails.members.forEach((member, memberIndex) => {
            app.tableData.body.elements.push(new Array({
                name: member.name.split(' ')[0],
                id: member.id,
            }));
            app.daysOfWeek.forEach((day, index) => {
                app.tableData.body.elements[memberIndex].push({ active: app.isDateActive(member.pto, index, today), index: index });
            })
        });
        let theader = tableElement.createTHead();
        let theaderRow = theader.insertRow(0);
        tableElement.appendChild(document.createElement('tbody'));
        let tableHeaderElement = tableElement.querySelector('thead tr');
        app.tableData.header.elements.forEach((header) => {
            let headerDataElement = document.createElement("th");
            let headerNode;
            if (header.hasOwnProperty('iconPath')) {
                let iconElem = document.createElement("i");
                iconElem.classList = ['material-icons mdl-list__item-icon'];
                iconElem.style.verticalAlign = 'middle';
                iconElem.innerText = 'person';
                headerNode = iconElem;
            } else {
                headerNode = document.createTextNode(header.day);
            }
            headerDataElement.appendChild(headerNode);
            tableHeaderElement.append(headerDataElement);
        });
        let tableBodyElement = document.querySelector('tbody');
        app.tableData.body.elements.forEach((member, index) => {
            let memberName = member[0].name;
            let memberIndex = index;
            let tableRow = document.createElement("tr");
            member.forEach((cell, index) => {
                let cellIndex = index;
                let tableBodyElement = document.createElement("td");
                let bodyNode;
                if (cell.hasOwnProperty('name')) {
                    bodyNode = document.createTextNode(cell.name);
                } else {
                    let abc = `${memberName}-${cellIndex}`;
                    let obj = {
                        currentIndex: cell.index,
                        activeIndex: today,
                        teamId: app.team,
                        memberId: member[0].id,
                        memberName: memberName,
                        checked: cell.active
                    };
                    obj = JSON.stringify(obj);
                    let checkBoxlabel = document.createElement("label");
                    checkBoxlabel.classList = ['mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect'];
                    checkBoxlabel.htmlFor = abc;
                    let checkBoxInput = document.createElement('input');

                    checkBoxInput.setAttribute("type", "checkbox");
                    checkBoxInput.setAttribute("id", abc);
                    checkBoxInput.setAttribute("data-value", obj);
                    checkBoxInput.className = "pto-checkbox mdl-checkbox__input";
                    checkBoxInput.checked = cell.active;
                    checkBoxlabel.appendChild(checkBoxInput);
                    checkBoxInput.addEventListener('change', app.checkBoxChange);
                    bodyNode = checkBoxlabel;
                }
                tableBodyElement.appendChild(bodyNode);
                tableRow.appendChild(tableBodyElement);
            });
            tableBodyElement.append(tableRow);
        })
        app.tableData.isBootstrapped = true;
    }

    app.setSidebar = function() {
        let teamDropdown = document.getElementById('Team-names');
        document.getElementById('calendar-date').innerText = `on ${new Date().toDateString()}`;
        let itemData;
        app.userDetails.teams.forEach((team) => {
            let dropdownItem = document.createElement("li");
            dropdownItem.className = "mdl-menu__item";
            itemData = document.createTextNode(team);
            dropdownItem.appendChild(itemData);
            teamDropdown.appendChild(dropdownItem);
        });
    }
    app.updateSidebar = function() {
        let activeUser = document.getElementById('current-user');
        let activeTeam = document.getElementById('current-team');
        activeTeam.innerText = app.teamDetails.name;
    }

    app.teamAvailability = function() {
        let teamSize = app.teamDetails.members.length;
        document.getElementById('calendar-team-name').innerText = app.teamDetails.name;
        let membersOnLeave = teamSize;
        let today = new Date().getDay();
        app.teamDetails.members.forEach((member) => {
            if (app.isDateActive(member.pto, today, today)) {
                membersOnLeave--;
            }
        });
        let teamPercentageAvailability = (membersOnLeave / teamSize) * 100;
        let availabilityChart = document.getElementById('availability-chart-svg');
        if (teamPercentageAvailability <= 50) {
            availabilityChart.style.color = "#F44336";
        } else if (teamPercentageAvailability > 50 && teamPercentageAvailability < 75) {
            availabilityChart.style.color = "#FFEB3B";
        } else {
            availabilityChart.style.color = "#4CAF50";
        }
        document.getElementById('availability-value').innerHTML = `${teamPercentageAvailability}%`;
    }

    app.updateTeamDetails = async function() {
        try {
            let teamUrl = app.getUrl(app.endpoints.teams);
            teamUrl.search = new URLSearchParams({ id: app.team });
            let teamResponse = await fetch(teamUrl);
            [app.teamDetails] = await teamResponse.json();
            app.updateSidebar();
            app.teamAvailability();
        } catch (e) {
            console.error(e);
        }
    }
    app.getMockObj = function() {
        let mockObj = {
            "_id": "5af05db6734d1d5358b998c3",
            "name": "Progressive Web",
            "id": "pwa",
            "members": [{
                    "id": "rhanda@deloitte.com",
                    "name": "Rachit Handa",
                    "pto": [
                        "17-4-2018",
                        "18-4-2018",
                        "20-4-2018",
                        "8-4-2018",
                        "6-4-2018",
                        "7-4-2018",
                        "13-4-2018",
                        "16-4-2018"
                    ]
                },
                {
                    "id": "abhishekpandey@deloitte.com",
                    "name": "Abhishek Pandey",
                    "pto": [
                        "11-4-2018",
                        "13-4-2018",
                        "15-4-2018",
                        "17-4-2018",
                        "6-4-2018",
                        "7-4-2018",
                        "14-4-2018",
                        "14-4-2018",
                        "18-4-2018",
                        "16-4-2018"
                    ]
                }
            ],
            "lastUpdated": "2018-05-13T18:32:45.280Z"
        }
        return mockObj;
    }

    /*****************************************************************************
     *
     * Service worker code
     *
     ****************************************************************************/

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker
            .register('./service-worker.js')
            .then(function() {
                console.log('Service Worker Registered');
            });
    } else {
        console.log('Service workers are not supported');
    }

    navigator.serviceWorker.ready
        .then(function(registration) {
            console.log(registration);
            return registration.pushManager.getSubscription()
                .then(async function(subscription) {
                    // If a existing subscription exists return it
                    if (subscription) {
                        return subscription;
                    }
                    await app.getVapidKeys();
                    // Convert a base64 string into a binary Uint8 Array
                    const convertedVapidKey = app.urlBase64ToUint8Array(app.vapidKeys);
                    console.log('Uint8 Array ', convertedVapidKey);
                    return registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: convertedVapidKey
                    });
                });
        }).then(function(subscription) {
            console.log('Push subscription object', subscription);
            app.subscription = subscription;
        });

    /*****************************************************************************
     *
     * Bootstrap the view
     *
     ****************************************************************************/
    app.getTeamDetails();
    app.setSidebar();

})();