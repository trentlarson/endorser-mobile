//
//  RCTBackgroundProcessor.m
//  EndorserMobile
//
//  Created by Trent Larson on 7/12/22.
//  From https://reactnative.dev/docs/native-modules-ios
//

#import "RCTBackgroundProcessor.h"
#import <React/RCTLog.h>

@implementation RCTBackgroundProcessor

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(initializeBgTasks:(NSString *)name callback:(RCTResponseSenderBlock)callback)
{
  RCTLogInfo(@"Pretending to create an event %@", name);

  callback(@[]);
}

/**
// only for testing -- disable before releasing, a la https://developer.apple.com/forums/thread/14855
// but doesn't actually exit
 RCT_EXPORT_METHOD(exit)
{
  RCTLogInfo(@"Exiting on demand");
  exit;
}
 **/

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getName)
{
  return [[UIDevice currentDevice] name];
}

@end
