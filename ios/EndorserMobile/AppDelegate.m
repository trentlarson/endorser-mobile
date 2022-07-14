#import "AppDelegate.h"

#import <BackgroundTasks/BackgroundTasks.h>
#import <React/RCTBridge.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>

#ifdef FB_SONARKIT_ENABLED
#import <FlipperKit/FlipperClient.h>
#import <FlipperKitLayoutPlugin/FlipperKitLayoutPlugin.h>
#import <FlipperKitUserDefaultsPlugin/FKUserDefaultsPlugin.h>
#import <FlipperKitNetworkPlugin/FlipperKitNetworkPlugin.h>
#import <SKIOSNetworkPlugin/SKIOSNetworkAdapter.h>
#import <FlipperKitReactPlugin/FlipperKitReactPlugin.h>

static NSString* uploadTask = @"ch.endorser.mobile.daily_task";

static void InitializeFlipper(UIApplication *application) {
  FlipperClient *client = [FlipperClient sharedClient];
  SKDescriptorMapper *layoutDescriptorMapper = [[SKDescriptorMapper alloc] initWithDefaults];
  [client addPlugin:[[FlipperKitLayoutPlugin alloc] initWithRootNode:application withDescriptorMapper:layoutDescriptorMapper]];
  [client addPlugin:[[FKUserDefaultsPlugin alloc] initWithSuiteName:nil]];
  [client addPlugin:[FlipperKitReactPlugin new]];
  [client addPlugin:[[FlipperKitNetworkPlugin alloc] initWithNetworkAdapter:[SKIOSNetworkAdapter new]]];
  [client start];
}
#endif

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application willFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  if (@available(iOS 13.0, *)) {
    NSLog(@"configureProcessingTask");
    [self configureProcessingTask];
  }
  return YES;
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
#ifdef FB_SONARKIT_ENABLED
  InitializeFlipper(application);
#endif

  RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];
  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge
                                                   moduleName:@"EndorserMobile"
                                            initialProperties:nil];

  rootView.backgroundColor = [[UIColor alloc] initWithRed:1.0f green:1.0f blue:1.0f alpha:1];

  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  UIViewController *rootViewController = [UIViewController new];
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];

  if (@available(iOS 13.0, *)) {
      NSLog(@"scheduleProcessingTask");
      [self scheduleProcessingTask];
  }

  return YES;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index" fallbackResource:nil];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

-(void)configureProcessingTask {
  NSLog(@"Doing things in configureProcessingTask");
  if (@available(iOS 13.0, *)) {
    [[BGTaskScheduler sharedScheduler] registerForTaskWithIdentifier:uploadTask
                                                          usingQueue:nil
                                                       launchHandler:^(BGTask *task) {
      [self scheduleLocalNotifications];
      [self handleProcessingTask:task];
    }];
    NSLog(@"Finished things in configureProcessingTask");
  } else {
    // No fallback
  }
}

-(void)scheduleLocalNotifications {
    NSLog(@"Doing things in scheduleLocalNotifications");
}

-(void)handleProcessingTask:(BGTask *)task API_AVAILABLE(ios(13.0)){
    //do things with task
    NSLog(@"Doing things in handleProcessingTask");
}

-(void)scheduleProcessingTask {
  NSLog(@"Doing things in scheduleProcessingTask");
  if (@available(iOS 13.0, *)) {
    NSError *error = NULL;
    // cancel existing task (if any)
    [BGTaskScheduler.sharedScheduler cancelTaskRequestWithIdentifier:uploadTask];
    // new task
    BGProcessingTaskRequest *request = [[BGProcessingTaskRequest alloc] initWithIdentifier:uploadTask];
    request.requiresNetworkConnectivity = YES;
    request.earliestBeginDate = [NSDate dateWithTimeIntervalSinceNow: 60 * 15];
    BOOL success = [[BGTaskScheduler sharedScheduler] submitTaskRequest:request error:&error];
    if (!success) {
      // Errorcodes https://stackoverflow.com/a/58224050/872051
      NSLog(@"Failed to submit request: %@", error);
    } else {
      NSLog(@"Success submit request %@", request);
    }
  } else {
    // No fallback
  }
}

@end
