node
{
    stage('Clone repository') {
        /* Let's make sure we have the repository cloned to our workspace */

        def scmVars = checkout scm
        //BELOW IS ONE WAY TO RESOLVE skip-ci ISSUE MSG. EXCLUSIONS - DIDN'T WORK
        //def scmVars = checkout([$class: 'GitSCM', branches: [[name: '*/master']], doGenerateSubmoduleConfigurations: false, extensions: [[$class: 'MessageExclusion', excludedMessage: '.*\\[ci skip\\].*'], [$class: 'LocalBranch', localBranch: 'master']], submoduleCfg: [], userRemoteConfigs: [[credentialsId: 'd65d4c50-3c94-46b6-bba9-f77da1041eb3', name: 'origin', refspec: '+refs/heads/master:refs/remotes/origin/master', url: 'https://arunkrishpsg@bitbucket.org/Guru_Rajendran/ies-groups.git']]])
        abortBuildIfCISkip()    //  Skip Build if triggered by Skippable Commit containing [ci skip] in commit msg; to avoid going into infinite loop due to jenkins pushes
        
        def GIT_COMMIT = scmVars.GIT_COMMIT     //scmVars holds all these git repo- related vars of the Git object, incl. full git commit hash string 
        env.GIT_COMMIT = scmVars.GIT_COMMIT     //adding this to global 'env' obj
        /* take() will substr the first 7 chars of the Git commit - this is imilar to abbreviated hash got using git log -1 --pretty=%h; we can use
         * other methods to get last 8 chars for eg */
        def short_commit = GIT_COMMIT.take(7)   
        println short_commit                    
        env.GIT_SHORT_COMMIT = short_commit    //adding this to global 'env' obj
        checkedOutBranch = scmVars.GIT_LOCAL_BRANCH //needed to retrive the local branch - usually master

        /* Another way of getting the git commit by writing that to file & trim to remove new line char
         * sh 'git rev-parse HEAD > commit'
         *  def commit = readFile('commit').trim() */ 
    }

/* Try - Catch begins - if there are errors thrown from next stage onwards, we should catch & handle them. 
    Right now, we set build status alone for sending email notification */

try
{
    stage('Build image') {
        /* This builds the actual image; synonymous to
         * docker build on the command line */

        app = docker.build("ies-group")
        
        /* NOTE: In case of snapshot builds, only this image will be built and always point to latest snapshot version
         * In case of release or nightly builds, we'll have 2 images - above one always pointing to latest but 
         * we'll also create a Release image or Nightly build image aptly tagged. */
    }
    
    stage('Run tests') {
        // Do testing by calling shell, running testscripts etc
    }
}    // end of try

catch (e)
{
     // If there was an exception thrown, the build failed
     currentBuild.result = "FAILURE"
     throw e
} 
finally
{
     // Success or failure, always send notifications - EDIT: Will still be called but only send mail on build failure
     notifyBuildStatus(currentBuild.result)     //  We send Build result notif. at this stage itself as further stages are about versioning/tagging
}
    stage('Read current version from package.json') {
        def nodeHome = tool 'NodeJSInstallation'     //needed for shell to execute node or npm cmd to parse package.json
        env.PATH="${env.PATH}:${nodeHome}/bin"        
        //sh "npm --no-git-tag-version version patch"    // 'npm version patch' does the actual bump; we'll commit & tag manually by adding to the SemVar
        def pkgJsonSemVer1 = sh(script: "node -p \"require('./package.json').version\"", returnStdout: true)    //read the current version key in package.json
        pkgJsonSemVer = pkgJsonSemVer1.trim() //source of so much time wasted as shell returns newline char!, so trim is must
        //currentBuild.displayName = pkgJsonSemVer + "-" + "${env.BUILD_NUMBER}"
    }  
    
    stage('Create Docker Image for Major/Minor Release') {
        majorFromPkgJson = (pkgJsonSemVer.tokenize(".")[0]).toInteger()  //Can be converted to Integer via majorInt = versionParts[0].toInteger()
        minorFromPkgJson = (pkgJsonSemVer.tokenize(".")[1]).toInteger()
        patchFromPkgJson = (pkgJsonSemVer.tokenize(".")[2]).toInteger()
        //sh "git tag -d \$(git tag -l)"  //Need to uncomment before usage if tags were created during testing

        //Now, build custom Version String by concatenating SemVar with {env.BUILD_NUMBER}, the Jenkins Build No and cut Git commit hash; write these to package.json and sep file called versionHistory.txt
        
        // START - Using Triggers to auto-run cron jobs for nightly build
        def triggers = []        
        startedByTimer = false
        versionToFileAndTagtoGit = false
        env.BRANCH_NAME = checkedOutBranch
        println checkedOutBranch
        if (env.BRANCH_NAME == 'master') {
            triggers << cron('H H(0-2) * * *')
            startedByTimer = isJobStartedByTimer()      // We verify this so that we can customize version string for nightly builds accordingly
            println "Started by timer? - " + startedByTimer    //    Note that script approvals to access currentBuild/rawBuild obj are needed
        }
        // startedByTimer = true   //   UNCOMMENT THIS ONLY FOR TESTING
        properties (
        [
        pipelineTriggers(triggers)  //  This is what will set the cron job when Jenkinsfile is run for the first time
        ]          )
        //END - Using Triggers to auto-run cron jobs for nightly build

        if (pkgJsonSemVer == "1.0.0")   //As goddamn git describe fails if no tags are present, another way of first-time build run test
        {
            if(startedByTimer)  // Check if build has run due to cron job
            {    
                pkgJsonSemVer = doGitTag()   
                versionToFileAndTagtoGit = true         
                fullVersion = "v" + pkgJsonSemVer + "-" + "${env.BUILD_NUMBER}" + "-NIGHTLY_BUILD" + "-" + "${env.GIT_SHORT_COMMIT}"    
                gitTagVersion = "v" + pkgJsonSemVer + "-" + "${env.BUILD_NUMBER}"    //a shorter build tag for git tagging
            }
            else
            {
                fullVersion = "v" + pkgJsonSemVer + "-" + "${env.BUILD_NUMBER}" + "-SNAPSHOT" + "-" + "${env.GIT_SHORT_COMMIT}"
                gitTagVersion = "v" + pkgJsonSemVer + "-" + "${env.BUILD_NUMBER}"    //a shorter build tag for git tagging                
            }
            currentBuild.displayName = gitTagVersion    //Change Jenkins UI display of a build
        }
        else // Git tagging is done atleast once, so safely use git describe
        {
            def gitTagChk = sh(script: "git describe --abbrev=0 --tags", returnStdout: true)  //'git describe' will get the most recent annotated tag        
            println gitTagChk
            def gitTag = gitTagChk.substring(1,gitTagChk.indexOf("-"))      //parse gitTag like v1.0.23-333 to get only the semvar - major & minor parts
            println gitTag      //gitTag will now only consists of semvar parts e.g. 1.0.23 
            def majorFromGitTag = (gitTag.tokenize(".")[0]).toInteger() //tokenize will split the string at periods & put it in array; so get the major number
            def minorFromGitTag = (gitTag.tokenize(".")[1]).toInteger() //tokenize will split the string at periods & put it in array; so get the minor number                
            //majorFromPkgJson = 1  // Can be uncommented and used for testing
            //minorFromPkgJson = 1  // Can be uncommented and used for testing
            
            // Compare major/minor no. in package.json with that in git tag
            if ((majorFromGitTag < majorFromPkgJson) || (minorFromGitTag < minorFromPkgJson))
            {
                println "PkgJson > GitTag - Create and Tag Docker Image as this is major/minor release"
                pkgJsonSemVer = doGitTag()            
                versionToFileAndTagtoGit = true
                fullVersion = "v" + pkgJsonSemVer + "-" + "${env.BUILD_NUMBER}" + "-RELEASE" + "-" + "${env.GIT_SHORT_COMMIT}"
                gitTagVersion = "v" + pkgJsonSemVer + "-" + "${env.BUILD_NUMBER}" + "-RELEASE"   //a shorter build tag for git tagging
                currentBuild.displayName = fullVersion //Change Jenkins UI display of a build
                releaseBuildImage = docker.build("ies-group:${fullVersion}")   //  Build another image & tag it for reference
                //sh "docker tag ies-group:latest ies-group:${fullVersion}" //\$\{gitTagVersion\}
            }
            else
            {
                println startedByTimer
                if(startedByTimer)  // Check if build has run due to cron job - tag docker image accordingly
                {
                    println "PkgJson = GitTag - Create & Tag Docker Image as this is time-triggered nightly build"
                    pkgJsonSemVer = doGitTag()    
                    versionToFileAndTagtoGit = true        
                    fullVersion = "v" + pkgJsonSemVer + "-" + "${env.BUILD_NUMBER}" + "-NIGHTLY_BUILD" + "-" + "${env.GIT_SHORT_COMMIT}"    
                    gitTagVersion = "v" + pkgJsonSemVer + "-" + "${env.BUILD_NUMBER}"    //a shorter build tag for git tagging
                    String oldNightlyBuildImage = ""
                    //Below, we remove last night's build by finding that image & passing it to xargs which will remove it if any such build is there or else not execute docker rm
                    oldNightlyBuildImage = sh(script:"docker images --filter=reference='ies-group:*NIGHTLY_BUILD*' -q | xargs --no-run-if-empty docker image rm", returnStdout: true)
                    println "Value is: " + oldNightlyBuildImage
                    nightlyBuildImage = docker.build("ies-group:${fullVersion}") //  Build another image & tag it for reference
                    //sh "docker tag ies-group:latest ies-group:${fullVersion}" //\$\{gitTagVersion\}
                }
                else
                {
                    println "PkgJson = GitTag - Don't Create and Tag Docker Image as this is patch build only- tag as snapshot version"
                    // fullVersion = "v" + pkgJsonSemVer + "-" + "${env.BUILD_NUMBER}" + "-SNAPSHOT" + "-" + "${env.GIT_SHORT_COMMIT}"
                    gitTagVersion = "v" + pkgJsonSemVer + "-" + "${env.BUILD_NUMBER}"    //a shorter build tag for git tagging                    
                }
                currentBuild.displayName = gitTagVersion  //Change Jenkins UI display of a build, show Release build tags alone explicitly
            }
        }      
    }          
        
    stage('Write Version String to File')  {
        //sh "git status -u"
        //sh "git clean -fd" //to remove untracked files + directories in the workspace; use this only during trial-test period

        // fileExists is necessary to check if versionHistory.txt already exists; if not, create it & add VersionVar; else, append VersionVar
    if (versionToFileAndTagtoGit == true) {   
        if (fileExists('versionHistory.txt')) {         
            def readContent = readFile('versionHistory.txt')
            println readContent
            def fileContent = writeFile file: 'versionHistory.txt', text: readContent + "\r\n" + fullVersion            
        } else {
            writeFile file: 'versionHistory.txt', text: fullVersion // + "\r\n"
        }
        def r = readFile('versionHistory.txt').trim()
        println r   //verify if versionHistory.txt has been updated
        }
    } 

    stage('Do Git Tagging with Version String') {
    if (versionToFileAndTagtoGit == true) {   
        sh "git remote -v"
        // git set init.testField "testValue" //DIDN'T WORK - this will directly add to package.json
        sh "git add package.json versionHistory.txt"        

        // Below is needed to get the Git credentials of repo to the shell to execute Git cmds through the Credentials plugin; credentialsId (for Arun, in this case) can be got from Jenkins
        withCredentials([[$class: 'UsernamePasswordMultiBinding', credentialsId: 'd65d4c50-3c94-46b6-bba9-f77da1041eb3', usernameVariable: 'GIT_USERNAME', passwordVariable: 'GIT_PASSWORD']]) 
        {
            sh "git remote set-url origin https://arunkrishpsg:PsgSt30092018@bitbucket.org/Guru_Rajendran/ies-groups.git"    //still needed, search for workaround later
            sh "git config user.name \"arunkrishpsg\""
            sh "git config user.email \"arun@psgsoftwaretechnologies.com\""
            sh "git commit -m \"Version now ${pkgJsonSemVer} [ci skip] on successful nightly/release build [skip_ci]\""    //"[skip ci] or [ci-skip] needed to tell Git Server to ignore this commit for building
            sh "git push -u origin master"
            sh "git tag -a ${gitTagVersion} -m \"Tag is ${gitTagVersion}\"" //use the shorter build tag for tagging repo
            sh "git push origin --tags"    //push the tags to the repo..
        }
    }
    } 

//Optionally, we can also add a test stage to test a Docker image using code like this:
    // stage('Test image') {
    //     /* Ideally, we would run a test framework against our image.
    //      

    //     app.inside {
    //         sh 'echo "Tests passed"'
    //     }
    // }
    
    stage('Run image') {
       /*command to run the latest image */
   
        sh "sudo bash check.sh"    //This only checks & removes all exited containers; NOT if container is active or not
        //To check if there is any active container running or not; only if container is running
        String containerExists = sh(script: "docker ps -f \"name=ies-group\" --format '{{.Names}}'", returnStdout: true)    //returns name of running container
        println containerExists
        //containerExists = sh(script: "if [\"\$(docker ps -f \"name=ies-fis\" --format '{{.Names}}') = ies-fis)\"]; then echo Yes; else echo No; fi", returnStdout: true)        
        if (containerExists.trim().toString().equals("ies-group"))
        {
            sh "docker stop ies-group"
            sh "docker rm ies-group"
        }        
        // Only latest image will be containerized - release or nightly build images must be manually containerized, if needed.
        sh "docker run -p 8005:8005 --name ies-group --restart=always --net=mongo-network ies-group:latest &"
        sh "sleep 5s"
        
        sh "docker restart ies-group"
    }
    
    stage('Restore DB dump') {
        /*command to restore mongodb dump*/    
        /*sh "sudo bash new.sh" */
           
        sh "docker exec -i mongodbctr bash -c 'mongorestore --db ies-groups --drop --gzip /data/ies-groups/' "  
        // A cron job to connect to a Prod DB in diff.s/m and back it up can be done here
    }  
} //end of node {}

def doGitTag()
{     
        /* This helps to bump the version in package.json and use it to build a customized fullVersion var which we can use 
         * everywhere including appending it to a file as well as git-tagging*/
        println "Inside doGitTag fn"
        def nodeHome = tool 'NodeJSInstallation'     //needed for shell to execute node or npm cmd to parse package.json
        env.PATH="${env.PATH}:${nodeHome}/bin"        
        sh "npm --no-git-tag-version version patch"    // 'npm version patch' does the actual bump; we'll commit & tag manually by adding to the SemVar
        def pkgJsonSemVer1 = sh(script: "node -p \"require('./package.json').version\"", returnStdout: true)    //read the current version key in package.json
        pkgJsonSemVer2 = pkgJsonSemVer1.trim() //source of so much time wasted as shell returns newline char!, so trim is must
        //currentBuild.displayName = pkgJsonSemVer + "-" + "${env.BUILD_NUMBER}"
        return pkgJsonSemVer2
}

// As all methods to skip build if triggered by Push from Jenkins itself failed, no other way but to parse..
// .. last commit and end/abort build if last commit msg had string [ci skip] in it
def abortBuildIfCISkip()
{
    def changeSetCount = 0;
    def ciSkipCount = 0;
    if (currentBuild.changeSets != null)    // changeSets gives the list of commits; each commit has a commitId, timestamp, msg, author
    {
        for (changeSetList in currentBuild.changeSets)
        {
            for (changeSet in changeSetList) 
            {
                changeSetCount++;
                if (changeSet.msg.contains('[ci skip]'))    //if any of the commit had [ci skip] in its commi msg 
                    ciSkipCount++;
            }
        }
    }
    if (changeSetCount > 0 && (changeSetCount == ciSkipCount)) //2nd condition I changed was ciSkipCount > 0
    {
        currentBuild.result = 'ABORTED'
        error("Stopping Build to prevent auto trigger. ${ciSkipCount} commit(s) contained [ci-skip]")
    }
}

//Email Notification...

def notifyBuildStatus(String buildStatus) {
   // build status of null means successful   
   buildStatus =  buildStatus ?: "SUCCESS"
   
   // Default values
   def subject = "${buildStatus}: Job '${env.JOB_NAME}, Build #[${env.BUILD_NUMBER}]'"
   def details = ""
   boolean startedByTimer = isTimeTriggeredBuild()
   println "startedbyTimer in Email fn" + startedByTimer   
   if (buildStatus.equals("FAILURE"))   //  Send mail only if build failed -as per Arun's request
   {
   if(startedByTimer)   // Can customize build message accordingly..
   {
   details = """<p>Nightly Build for the Job '${env.JOB_NAME}' with Build No: [${env.BUILD_NUMBER}] finished with status '${buildStatus}'</p>
     <p>Check console output at "<a href="${env.BUILD_URL}">${env.JOB_NAME} [${env.BUILD_NUMBER}]</a>"</p>"""
    }
    else
    {       
    details = """<p>Build for the Job '${env.JOB_NAME}' with Build No: [${env.BUILD_NUMBER}] finished with status '${buildStatus}'</p>
     <p>Check console output at "<a href="${env.BUILD_URL}">${env.JOB_NAME} [${env.BUILD_NUMBER}]</a>"</p>"""
    }
     
     // Send email to recipients defined in Recipient list indicated by class 'DevelopersRecipientProvider' (in jenkins -> Configure System) - we can fine-tune this later 

    emailext (

       subject: subject,
       body: details,
       to: 'cc:arun@psgsoftwaretechnologies.com;subramanian.nh@psgsoftwaretechnologies.com;ananthaguru.r@psgsoftwaretechnologies.com',
       recipientProviders: [[$class: 'DevelopersRecipientProvider']]

     )          
    }
   }

// Check if the job was started by a timer

//@NonCPS     //needed - NonCPS function must be run outside of a node block.
def isJobStartedByTimer() {
    def startedByTimer = false
    try {
        def buildCauses = currentBuild.rawBuild.getCauses()     //  One way is to use getCauses to get a value like 'TimerTriggerCause'
        println "inside isJobStartedbyTimer()"
        for ( buildCause in buildCauses ) {
            if (buildCause != null) {
                def causeDescription = buildCause.getShortDescription()
                echo "shortDescription: ${causeDescription}"
                if (causeDescription.contains("Started by timer")) {    // 'TimerTriggerCause' obj will contain field causeDescription, so checking..
                    startedByTimer = true
                }
            }
        }
    } catch(theError) {
        echo "Error getting build cause"
    }
 
    return startedByTimer
}

//    Another nice fn to check if build triggered by cron - used in Email notification 
 boolean isTimeTriggeredBuild() {    
    for (Object currentBuildCause : currentBuild.rawBuild.getCauses()) {
        return currentBuildCause.class.getName().contains('TimerTriggerCause')
    }
    return false
}