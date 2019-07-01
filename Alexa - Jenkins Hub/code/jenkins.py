"""
Jenkins methods.

(c) 2018 Balloon Inc. VOF
Wouter Devriendt
"""
import requests
import os
from fuzzywuzzy import process

class Jenkins:
    def __init__(self, jenkins_url='http://ec2-18-212-172-124.compute-1.amazonaws.com/', username='admin', auth_token='1161a0f90af734477c120a3b335de4e9a5', jobs=[]):
        self.jenkins_url = jenkins_url
        

    def startJob(self, jobname):
        url='http://ec2-18-212-172-124.compute-1.amazonaws.com/job/TestHello/build?delay=0sec'
        #url = self.jenkins_url+"/job/" + jobname + "/build"
        return requests.post(url, auth=None)

    def getJobStatus(self, jobname):
         
        url='http://ec2-18-212-172-124.compute-1.amazonaws.com/job/TestHello/lastBuild/api/json?tree=result,timestamp,estimatedDuration,number,building,duration'
    #    url = self.jenkins_url + "/job/" + jobname + \
    #        "/lastBuild/api/json?tree=result,timestamp,estimatedDuration,number,building,duration"
        return requests.get(url, auth=None)
    

    def readSettingsFromEnvironment(self):
        self.jenkins_url = os.environ["jenkins_url"]
        self.username = os.environ["jenkins_username"]
        self.auth_token = os.environ["jenkins_auth_token"]
    
  
# --------------- Tests for job interaction and fuzzy search ------------------


if __name__ == "__main__":
    import time
    jenkins = Jenkins()
    jenkins.readSettingsFromFile()

    testJobInteraction(jenkins)
    #testFuzzySearch(jenkins)
