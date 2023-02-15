/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';

//localhost routes

FlowRouter.route('/', {
    name: 'main',
    action() {
        if (Meteor.settings.public.scorecard) {
            this.render('ScorecardHome');
        } else {
            if (Meteor.settings.public.custom) {
                this.render('CustomHome');
            } else {
                    if (Meteor.settings.public.undefinedRoles != undefined && Meteor.settings.public.undefinedRoles.length > 0) {
                        this.render('Configure');
                    } else {
                        this.render('Home');
                    }
                }
        }
    }
});

FlowRouter.route('/CSV/:graphFunction/:key/:matching/:appName', {
    name: 'csv',
    action(params) {
        window.location.href=FlowRouter.path;
    }
});

FlowRouter.route('/JSON/:graphFunction/:key/:matching/:appName', {
    name: 'json',
    action(params) {
        window.location.href=FlowRouter.path;
    }
});

FlowRouter.route('/scorecard/scorecard_display/:userName/:name/:submitted/:processedAt', {
    name: 'scorecard/scorecard_display',
    action(params) {
        this.render('ScorecardDisplay', params);
    }
});


FlowRouter.route('/preview/:graphFunction/:key/:matching/:appName', {
    name: 'preview',
    action(params) {
        this.render('GraphStandAlone', params);
    }
});

//prefix routes
FlowRouter.route(Meteor.settings.public.proxy_prefix_path + '/', {
    name: 'main',
    action() {
        if (Meteor.settings.public.custom) {
            this.render('CustomHome');
        }
        else {
            this.render('Home');
        }
    }
});

FlowRouter.route(Meteor.settings.public.proxy_prefix_path + '/CSV/:graphFunction/:key/:matching/:appName', {
    name: 'csv',
    action(params) {
        window.location.href=FlowRouter.path;
    }
});

FlowRouter.route(Meteor.settings.public.proxy_prefix_path + '/JSON/:graphFunction/:key/:matching/:appName', {
    name: 'json',
    action(params) {
        window.location.href=FlowRouter.path;
    }
});

FlowRouter.route(Meteor.settings.public.proxy_prefix_path + '/preview/:graphFunction/:key/:matching/:appName', {
    name: 'preview',
    action(params) {
        this.render('GraphStandAlone', params);
    }
});

FlowRouter.route(Meteor.settings.public.proxy_prefix_path + '/scorecard/scorecard_display/:userName/:name/:submitted/:processedAt', {
    name: 'scorecard/scorecard_display',
action(params) {
    this.render('ScorecardDisplay', params);
}
});


// appname routes
FlowRouter.route(Meteor.settings.public.proxy_prefix_path + '/:appName', {
    name: 'main',
    action() {
        if (Meteor.settings.public.custom) {
            this.render('CustomHome');
        }
        else {
            this.render('Home');
        }
    }
});

FlowRouter.route(Meteor.settings.public.proxy_prefix_path + '/*/CSV/:graphFunction/:key/:matching/:appName', {
    name: 'csv',
    action(params) {
        window.location.href=FlowRouter.path;
    }
});

FlowRouter.route(Meteor.settings.public.proxy_prefix_path + '/*/JSON/:graphFunction/:key/:matching/:appName', {
    name: 'json',
    action(params) {
        window.location.href=FlowRouter.path;
    }
});

FlowRouter.route(Meteor.settings.public.proxy_prefix_path + '/*/preview/:graphFunction/:key/:matching/:appName', {
    name: 'preview',
    action(params) {
        this.render('GraphStandAlone', params);
    }
});

FlowRouter.route(Meteor.settings.public.proxy_prefix_path + '/*/scorecard/scorecard_display/:userName/:name/:submitted/:processedAt', {
        name: 'scorecard_display',
    action(params) {
        this.render('ScorecardDisplay', params);
    }
});


// exception routes
FlowRouter.route(Meteor.settings.public.proxy_prefix_path + '/*/', {
    name: 'main',
    action() {
        this.render('notFound')
    }
});

FlowRouter.route('/*', {
    action() {
        console.log ('route: ' + ' not found' );
        this.render('notFound');
    }
});
