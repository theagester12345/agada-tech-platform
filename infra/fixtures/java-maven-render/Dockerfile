# syntax=docker/dockerfile:1
# Same two-stage shape as a Spring Boot caller: compile in the Maven image,
# run a slim JRE. Tests stay in CI `mvn verify`, not in this build.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests clean package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
