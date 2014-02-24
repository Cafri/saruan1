var c;
$(function () {
    $.ajax({
        type: 'GET',
        url: 'https://raw.github.com/tribalCarigan/Tribalwars/master/htmlsnippets/contentContainer.html',
        data: 'callback=c',
        success: function (data) { c(data); },
        dataType: 'jsonp'
    });
    var outPut, hiddenFrame, hiddenFrameUrl, attackButton, sAttackButton, rAttackButton, cAttackButton, popup, messages, spinner, villagearr, targets, attackId, templAttackId, villages, continuousAttack, botting, ignorePlayers, attackList, activeInterval, tmptimers;

    var attacking = false;
    var continueAttack = true;
    var timersAvailable = false;
    var timerOff = false;
    var attackTemplates = {};
    var unitPerAttack = [];
    var unitTypes = {
        'unit_input_spear': 'Spears',
        'unit_input_sword': 'Swords',
        'unit_input_axe': 'Olafs',
        'unit_input_spy': 'Scouts',
        'unit_input_light': 'LC',
        'unit_input_heavy': 'HC',
        'unit_input_ram': 'Rams',
        'unit_input_catapult': 'Catas',
        'unit_input_knight': 'Palas',
        'unit_input_snob': 'Nobles'
    };
    c = function (data) {
        hiddenFrameUrl = '/game.php?village=' + game_data.village.id + '&screen=place';
        $(data.htmlSnippet).insertBefore('#contentContainer');
        timersAvailable = timers.length > 0;
        popup = $(data.popup).appendTo('body').hide();
        outPut = $('#newContent').css({
            'position': 'relative'
        });
        hiddenFrame = $('<iframe src="' + hiddenFrameUrl + '" />').load(frameLoaded)
// Firefox fix?!
//			.attr('width', '0px')
//			.attr('height', '0px')
			.css({ width: '1px', height: '1px', position: 'absolute', left: '-1000px' })
			.appendTo(outPut)
        //			.hide()
        ;
        attackButton = $('#attackButton').click(attack);
        sAttackButton = $('#sAttackButton').click(stopAttack).hide();
        rAttackButton = $('#resetAttack').click(resetAttack);
        cAttackButton = $('#cAttackButton').click(function () { showAttackTemplate(); });
        attackTemplateSaveLink = $('#saveTemplate').click(templateFinished);
        templAttackId = $('#template_attackId');
        // css isn't loaded in chrome when served from github because of faulty
        // headers
        // $('<link rel="stylesheet" type="text/css" href="https://raw.github.com/tribalCarigan/Tribalwars/master/htmlsnippets/contentContainer.css" />').appendTo('body');
        spinner = $('#loading').css({
            'position': 'absolute',
            'right': '0',
            'bottom': '0'
        });
        continuousAttack = $('#continuousAttack').click(function () {
            if (!$(this).is(':checked') && $('#botting').is(':checked')) {
                $('#botting').attr('checked', false);
                toggleTimer();
            }
        }).css({

        });
        botting = $('#botting').click(function () {
            if ($(this).is(':checked')) {
                $('#continuousAttack').attr('checked', true);
            } else {
            }
            toggleTimer();
        }).css({

        });
        ignorePlayers = $('#ignorePlayers').click(function () {
            if ($(this).is(':checked')) {
                writeOut('Ignoring player villages: [ON]');
            } else {
                writeOut('Ignoring player villages: [OFF]');
            }
        }).css({

        });
        $('#buttons label').css({
            'width': '78px',
            'display': 'inline-block'
        });
        attackList = $('#attackList').css({
            'width': '120px',
            'float': 'right',
            'margin-top': '10px'
        });
        $('#attackName').css({
            'margin': '0',
            'margin-left': '300px'
        });
        $('#buttons').css({
            'width': '130px',
            'float': 'right'
        });
        $('#buttons button').css({
            'width': '100px'
        });
        $('#buttons p').css({
            'width': '100px'
        });
        $('#unitTable').css({
            'margin-left': '300px'
        });
        messages = $('#messages').css({
            'list-style': 'none',
            'float': 'left',
            'width': '250px',
            'height': '90px',
            'overflow': 'auto'
        });
        loadAttacks();

        toggleTimer = function () {
            if (!timersAvailable) {
                timerOff = true;
                return;
            }
            if (timers.length > 0) {
                timerOff = true;
                tmptimers = timers;
                timers = [];
            } else {
                timers = tmptimers;
                timerOff = false;
            }
        };

        polling = function () {
            continueAttack = true;
            attacking = true;
            hiddenFrame.attr('src', hiddenFrame.attr('src'));
            $('#show_outgoing_units .vis').replaceWith(hiddenFrame.contents().find('table.vis:contains("Own")'));
        };
    };

    function sendUnits(unitType) {
        if (unitPerAttack[unitType] == 0) return true;
        var unitAmount = hiddenFrame.contents().find('#' + unitType).siblings().last().html();
        if (parseInt(unitAmount.substr(1, unitAmount.length - 2)) >= parseInt(unitPerAttack[unitType])) {
            hiddenFrame.contents().find('#' + unitType).val(unitPerAttack[unitType]);
            return true;
        }
        if (botting.is(':checked')) {
            UI.InfoMessage(('Not enough units of type: ' + unitTypes[unitType] + ' waiting till some return...'), 3000);
        } else {
            UI.ErrorMessage(('Not enough units of type: ' + unitTypes[unitType]), 3000);
            stopAttack();
        }
        return false;
    }
    function writeOut(message) {
        messages.append('<li>' + message + '</li>');
        messages.scrollTop(messages[0].scrollHeight);
    }
    function storeVal(name, value) {
        localStorage.setItem(game_data.village.id + '_' + name, value);
    }
    function loadVal(name) {
        return localStorage.getItem(game_data.village.id + '_' + name);
    }
    function deleteVal(name) {
        localStorage.removeItem(game_data.village.id + '_' + name);
    }

    function frameLoaded() {
        spinner.fadeOut();
        var submitAttack = hiddenFrame.contents().find('#troop_confirm_go');
        var botProtection = hiddenFrame.contents().find('#bot_check');
        var generalError = hiddenFrame.contents().find('#error');
        var playerVillage = hiddenFrame.contents().find('table.vis td:contains("Player")');
        if (generalError.length > 0 && generalError.html().indexOf("banned") !== -1) {
            UI.ErrorMessage('The village owner is banned! Continuing with next Village', 3000);
            coordData = villagearr[getPosition()];
            writeOut('Ignoring [' + coordData + '] (Banned User)');
            return ignoreVillage();
        }
        if (generalError.length > 0 && generalError.html().indexOf("beginner") !== -1) {
            UI.ErrorMessage(generalError.html() + ' Continuing with next Village', 3000);
            coordData = villagearr[getPosition()];
            writeOut('Ignoring [' + coordData + '] (Beginner Protection)');
            return ignoreVillage();
        }
        if (generalError.length > 0 && generalError.html().indexOf("Christmas") !== -1) {
            UI.ErrorMessage(generalError.html() + ' Continuing with next Village', 3000);
            coordData = villagearr[getPosition()];
            writeOut('Ignoring [' + coordData + '] (Christmas...)');
            return ignoreVillage();
        }
        if (botProtection.size() != 0) {
            UI.ErrorMessage('Bot Protection! you need to enter a captcha somewhere... not sure yet what to do yet<br />Disabling botmode for now!', 3000);
            writeOut('Bot Protection! you need to enter a captcha somewhere... not sure yet what to do yet<br />Disabling botmode for now!');
            var captcha = hiddenFrame.contents().find('#bot_check_image');
            var input = hiddenFrame.contents().find('#bot_check_code');
            var submit = hiddenFrame.contents().find('#bot_check_submit');
            botting.attr('checked', false);
            stopAttack();
        }
        if (playerVillage.length > 0 && ignorePlayers.is(':checked')) {
            UI.ErrorMessage('The village owner is a player! Continuing with next Village', 3000);
            coordData = villagearr[getPosition()];
            writeOut('Ignoring [' + coordData + '] (player)');
            return ignoreVillage();
        }
        if (submitAttack.size() == 0) {
            loadAttack(attackId);
            showAttack();
            if (attacking && continueAttack) {
                attack();
            }
        } else {
            attackTemplates[attackId].position = getPosition() + 1;
            if (getPosition() >= targets) {
                if (continuousAttack.is(':checked')) {
                    resetAttack();
                } else {
                    stopAttack();
                }
            }
            storeVal('attacktemplates', JSON.stringify(attackTemplates));
            spinner.show();
            submitAttack.click();
        }
    }
    function ignoreVillage() {
        attackTemplates[attackId].position = getPosition() + 1;
        if (getPosition() >= targets) {
            if (continuousAttack.is(':checked')) {
                resetAttack();
            } else {
                stopAttack();
            }
        }
        storeVal('attacktemplates', JSON.stringify(attackTemplates));
        hiddenFrame.attr('src', hiddenFrameUrl);
    }
    function attack() {
        attackButton.hide();
        sAttackButton.show();
        coordData = villagearr[getPosition()];
        getCoords = coordData.split("|");
        continueAttack = true;
        for (unitType in unitPerAttack) {
            if (continueAttack) {
                continueAttack = sendUnits(unitType);
            }
        }
        if (continueAttack) {
            hiddenFrame.contents().find('#inputx').val(getCoords[0]);
            hiddenFrame.contents().find('#inputy').val(getCoords[1]);
            hiddenFrame.contents().find('#target_attack').click();
            attacking = true;
            spinner.show();
            writeOut('Attacking: [' + coordData + ']');
            return;
        }
        if (timerOff && botting.is(':checked')) {
            var returningAttack = hiddenFrame.contents().find('table.vis:contains("Own") tr td:contains("Return"):first').siblings().next().first().find('span').html();
            var timeContainer = [];
            if (returningAttack != null) {
                timeContainer = returningAttack;
            } else {
                timeContainer = hiddenFrame.contents().find('table.vis:contains("Own") tr td:contains("Attack"):first').siblings().next().first().find('span.timer').html();
            }
            var nextAttackInSeconds = timeContainer.split(':');
            nextAttackInSeconds = parseInt(nextAttackInSeconds[0] * 3600) + parseInt(nextAttackInSeconds[1] * 60) + parseInt(nextAttackInSeconds[2]);
            writeOut('Next return in ' + nextAttackInSeconds + ' Seconds');
            activeInterval = window.setTimeout(polling, nextAttackInSeconds * 1000 + 1);
        }
    }
    function getPosition() {
        return parseInt(attackTemplates[attackId].position);
    }
    function stopAttack() {
        attackButton.show();
        sAttackButton.hide();
        attacking = false;
        continueAttack = false;
        if (getPosition() >= targets) {
            UI.SuccessMessage("Cycle complete, stopping attack and resetting to first Coords.", 3000);
            resetAttack(true);
        }
    }
    function resetAttack(fullCycle) {
        if (!fullCycle) UI.SuccessMessage("Resetting to first Coords.", 3000);
        attackTemplates[attackId].position = 0;
        $('#attackedVillages').val(getPosition() + 1);
        storeVal('attacktemplates', JSON.stringify(attackTemplates));
    }
    function showAttackTemplate(id) {
        if (id) {
            templAttackId.val(id);
            $('#template_name').val(attackTemplates[id].name);
            $('#template_coords').val(attackTemplates[id].coords);
            for (unitType in unitTypes) {
                $('#template_' + unitType).val(attackTemplates[id].unitsPerAttack[unitType]);
            }
            $('#template_position').val(attackTemplates[id].position);
        } else {
            templAttackId.val('');
            $('#template_name').val('');
            $('#template_coords').val('');
            $('#template_position').val(0);
            for (unitType in unitTypes) {
                $('#template_' + unitType).val(0);
            }
        }
        popup.show();
    }

    function templateFinished() {
        if (templAttackId.val()) {
            saveAttack(templAttackId.val());
            loadAttack(attackId);
        } else {
            createAttack();
        }
        if (templAttackId.val() == attackId || !attackId) {
            loadAttack(attackId);
        }
        populateAttackList();
        popup.hide();
    }

    function createAttack() {
        var newId = '_' + new Date().getTime(); // attackTemplates.length; what happens if an entry gets removed?
        $('#template_position').val(0);
        saveAttack(newId);
        populateAttackList();
    }

    function saveAttack(id) {
        var templateUnits = {};
        for (unitType in unitTypes) {
            templateUnits[unitType] = $('#template_' + unitType).val();
        }

        var attack = {
            name: $('#template_name').val().trim(),
            unitsPerAttack: templateUnits,
            coords: $('#template_coords').val().trim(),
            position: $('#template_position').val()
        };
        attackTemplates[id] = attack;
        storeVal('attacktemplates', JSON.stringify(attackTemplates));
    }

    function loadAttacks() {
        attackTemplates = JSON.parse(loadVal('attacktemplates'));
        populateAttackList();
    }

    function showAttack() {
        for (unitType in unitPerAttack) {
            $('#' + unitType).val(unitPerAttack[unitType]).change(function (e) {
                /*
				 * // not feasible with the attacktemplates anymore
				 * unitPerAttack[e.target.id] = $(e.target).val();
				 * storeVal(e.target.id, unitPerAttack[e.target.id]);
				 * writeOut('Updated amount for ' + unitTypes[e.target.id] + '
				 * to: ' + unitPerAttack[e.target.id]);
				 */
            }).focus(function (e) {
                $(this).blur();
                showAttackTemplate(attackId);
                $('#template_' + unitPerAttack[e.target.id]).focus().select();
            });
            var unitAmount = hiddenFrame.contents().find('#' + unitType).siblings().last().html();
            $('#amount_of_' + unitType).html(unitAmount.substr(1, unitAmount.length - 2));
        }
    }

    function loadAttack(id) {
        if (!id) {
            for (id in attackTemplates) break;
            if (!id) {
                // new user.. show templates
                attackTemplates = {};
                showAttackTemplate();
                $('#template_position').val(0);
                return;
            }
        }
        attackId = id;
        var attack = attackTemplates[id];
        $('#attackName').html(attack.name);

        for (unitType in unitTypes) {
            unitPerAttack[unitType] = attack.unitsPerAttack[unitType];
        }
        villages = attack.coords;
        villagearr = villages.split(" ");
        targets = villagearr.length;
        $('#attackedVillages').val(getPosition() + 1);
        $('#amount_of_attackedVillages').html(targets);
        showAttack();
        return attack;
    }

    function removeAttack(id) {
        delete attackTemplates[id];
        if (attackId == id) {
            // load now first entry in the list
            loadAttack();
        }
        storeVal('attacktemplates', JSON.stringify(attackTemplates));
        populateAttackList();
    }
    function populateAttackList() {
        // reset the list just to be sure
        attackList.children().remove();
        for (var templId in attackTemplates) {
            var item = $('<tr/>').appendTo(attackList);
            $('<td title="Load this attack" />').html('L').bind('click', { attack: templId }, function (event) { loadAttack(event.data.attack); }).css({
                'width': '10px',
                'cursor': 'pointer',
                'color': '#00f',
                'background-color': '#fff'
            }).appendTo(item);
            $('<td>' + attackTemplates[templId].name + '</td>').appendTo(item);
            $('<td title="Remove this attack (CAN NOT BE UNDONE)" />').html('X').bind('click', { attack: templId }, function (event) { removeAttack(event.data.attack); }).css({
                'width': '10px',
                'cursor': 'pointer',
                'color': '#f00'
            }).appendTo(item);
        }
        // some "styling"
        $('#attackList tr').css({
            'height': '10px'
        });
        $('#attackList tr:odd').css({
            'background-color': '#c0c0c0'
        });
    }

});