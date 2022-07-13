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

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getName)
{
  return [[UIDevice currentDevice] name];
}

@end
